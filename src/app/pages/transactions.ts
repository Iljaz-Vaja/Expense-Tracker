import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { UiService } from '../services/ui.service';
import { CATEGORIES, getCategory } from '../models/category';
import { ExpenseEntry } from '../models/expense';
import { MoneyPipe } from '../shared/money.pipe';
import { Icon } from '../shared/icon';
import { ExpenseRow } from '../shared/expense-row';
import { PERIOD_LABELS, Period, dayKey, inRange, periodRange } from '../utils/date';
import { sum } from '../utils/stats';
import { downloadFile, stamp, toCsv } from '../utils/export';

type Sort = 'newest' | 'oldest' | 'highest' | 'lowest' | 'amountDesc';

interface Group {
  key: string;
  date: Date;
  total: number;
  entries: ExpenseEntry[];
}

const PAGE = 30;

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [FormsModule, DatePipe, MoneyPipe, Icon, ExpenseRow],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ svc.entries().length }} total records</p>
        <h1>Transactions</h1>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" (click)="exportCsv()" [disabled]="!filtered().length">
          <app-icon name="download" [size]="18" /> <span class="hide-mobile">Export CSV</span>
        </button>
        <button class="btn btn-primary hide-mobile" (click)="ui.openAdd()">
          <app-icon name="plus" [size]="18" /> Add expense
        </button>
      </div>
    </header>

    <section class="card filters">
      <div class="search">
        <app-icon name="search" [size]="18" />
        <input
          type="search"
          placeholder="Search title or note…"
          aria-label="Search expenses"
          [ngModel]="query()"
          (ngModelChange)="query.set($event); limit.set(page)"
        />
      </div>
      <div class="filter-row">
        <select aria-label="Period" [ngModel]="period()" (ngModelChange)="period.set($event); limit.set(page)">
          @for (p of periods; track p) { <option [value]="p">{{ periodLabels[p] }}</option> }
        </select>
        <select aria-label="Sort" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest day total</option>
          <option value="lowest">Lowest day total</option>
          <option value="amountDesc">Biggest expenses (no grouping)</option>
        </select>
      </div>
      @if (period() === 'custom') {
        <div class="filter-row">
          <label class="inline">From <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" /></label>
          <label class="inline">To <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" /></label>
        </div>
      }
      <div class="chips" role="group" aria-label="Filter by category">
        <button type="button" class="chip" [class.on]="category() === 'all'" (click)="category.set('all')">All</button>
        @for (c of categories; track c.id) {
          <button type="button" class="chip" [class.on]="category() === c.id" (click)="toggleCategory(c.id)">
            {{ c.icon }} {{ c.label }}
          </button>
        }
      </div>
    </section>

    <div class="summary-bar">
      <span><strong>{{ filtered().length }}</strong> {{ filtered().length === 1 ? 'expense' : 'expenses' }}</span>
      <span>Total <strong>{{ filteredTotal() | money }}</strong></span>
      @if (hasFilters()) {
        <button class="link" (click)="clearFilters()">Clear filters</button>
      }
    </div>

    @if (!filtered().length) {
      <section class="card empty">
        <div class="empty-art">🔍</div>
        @if (svc.entries().length) {
          <h2>No matching expenses</h2>
          <p>Try a different search, period or category.</p>
        } @else {
          <h2>No expenses yet</h2>
          <p>Tap the + button to add your first one.</p>
        }
      </section>
    } @else if (sort() === 'amountDesc') {
      <section class="card group">
        @for (e of flat(); track e.index) {
          <app-expense-row [entry]="e" [showDate]="true" />
        }
      </section>
    } @else {
      @for (g of visibleGroups(); track g.key) {
        <section class="card group">
          <header class="group-head">
            <h3>{{ g.date | date: 'EEEE, MMM d, y' }}</h3>
            <span class="day-total">{{ g.total | money }}</span>
          </header>
          @for (e of g.entries; track e.index) {
            <app-expense-row [entry]="e" />
          }
        </section>
      }
    }

    @if (canShowMore()) {
      <button class="btn btn-ghost more" (click)="limit.set(limit() + page)">Show more</button>
    }
  `,
  styles: `
    .head-actions { display: flex; gap: 8px; }
    .filters { display: flex; flex-direction: column; gap: 12px; }
    .search { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 12px; background: var(--surface-2); color: var(--text-3); border: 1px solid transparent; }
    .search:focus-within { border-color: var(--accent); }
    .search input { flex: 1; border: 0; background: transparent; padding: 11px 0; outline: none; box-shadow: none; }
    .filter-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .filter-row select, .filter-row label { flex: 1 1 180px; }
    .inline { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); }
    .inline input { flex: 1; }
    .chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; margin: 0 -4px; padding-inline: 4px; }
    .chips::-webkit-scrollbar { display: none; }
    .summary-bar { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 4px 4px 0; color: var(--text-2); font-size: 14px; }
    .summary-bar strong { color: var(--text); }
    .summary-bar .link { margin-left: auto; }
    .group { padding: 8px; }
    .group-head { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 10px 6px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
    .group-head h3 { margin: 0; font-size: 14px; color: var(--text-2); font-weight: 600; }
    .day-total { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 14px; }
    .more { align-self: center; }
    .empty { text-align: center; padding: 40px 20px; }
    .empty-art { font-size: 44px; }
    .empty p { color: var(--text-2); }
  `,
})
export class TransactionsPage {
  protected readonly svc = inject(ExpenseService);
  protected readonly ui = inject(UiService);

  protected readonly categories = CATEGORIES;
  protected readonly periods = Object.keys(PERIOD_LABELS) as Period[];
  protected readonly periodLabels = PERIOD_LABELS;
  protected readonly page = PAGE;

  protected readonly query = signal('');
  protected readonly category = signal('all');
  protected readonly period = signal<Period>('all');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly sort = signal<Sort>('newest');
  protected readonly limit = signal(PAGE);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.category();
    const range = periodRange(this.period(), this.from(), this.to());
    return this.svc.entries().filter(
      (e) =>
        inRange(e.time, range) &&
        (cat === 'all' || getCategory(e.expense.category).id === cat) &&
        (!q ||
          e.expense.title.toLowerCase().includes(q) ||
          (e.expense.note ?? '').toLowerCase().includes(q)),
    );
  });

  protected readonly filteredTotal = computed(() => sum(this.filtered()));

  protected readonly groups = computed<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of this.filtered()) {
      const key = dayKey(e.time); // local day, not UTC
      let g = map.get(key);
      if (!g) {
        g = { key, date: new Date(e.time.getFullYear(), e.time.getMonth(), e.time.getDate()), total: 0, entries: [] };
        map.set(key, g);
      }
      g.entries.push(e);
      g.total += Number(e.expense.amount) || 0;
    }
    const list = [...map.values()];
    const asc = this.sort() === 'oldest';
    list.forEach((g) => g.entries.sort((a, b) => (asc ? 1 : -1) * (a.time.getTime() - b.time.getTime())));
    switch (this.sort()) {
      case 'oldest': return list.sort((a, b) => a.date.getTime() - b.date.getTime());
      case 'highest': return list.sort((a, b) => b.total - a.total);
      case 'lowest': return list.sort((a, b) => a.total - b.total);
      default: return list.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
  });

  protected readonly visibleGroups = computed(() => this.groups().slice(0, this.limit()));
  protected readonly flat = computed(() =>
    [...this.filtered()].sort((a, b) => b.expense.amount - a.expense.amount).slice(0, this.limit() * 3),
  );
  protected readonly canShowMore = computed(() =>
    this.sort() === 'amountDesc'
      ? this.filtered().length > this.limit() * 3
      : this.groups().length > this.limit(),
  );

  protected readonly hasFilters = computed(
    () => !!this.query() || this.category() !== 'all' || this.period() !== 'all',
  );

  protected toggleCategory(id: string) {
    this.category.set(this.category() === id ? 'all' : id);
    this.limit.set(PAGE);
  }

  protected clearFilters() {
    this.query.set('');
    this.category.set('all');
    this.period.set('all');
    this.limit.set(PAGE);
  }

  protected exportCsv() {
    const rows = [...this.filtered()].sort((a, b) => a.time.getTime() - b.time.getTime()).map((e) => e.expense);
    downloadFile(`expenses-${stamp()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
    this.ui.toast(`Exported ${rows.length} expenses`, { tone: 'success' });
  }
}
