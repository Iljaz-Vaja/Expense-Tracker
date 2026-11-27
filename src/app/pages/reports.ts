import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { TxType } from '../models/expense';
import { MoneyPipe } from '../shared/money.pipe';
import { BarChart } from '../shared/bar-chart';
import { CashflowChart } from '../shared/cashflow-chart';
import { ExpenseRow } from '../shared/expense-row';
import { PERIOD_LABELS, Period, periodRange, startOfDay } from '../utils/date';
import {
  byCategory,
  cashflowSeries,
  filterRange,
  incomes,
  savingsRate,
  spending,
  sum,
  weekdaySeries,
} from '../utils/stats';

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [FormsModule, MoneyPipe, BarChart, CashflowChart, ExpenseRow, DecimalPipe],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Insights</p>
        <h1>Reports</h1>
      </div>
    </header>

    <section class="card filters">
      <div class="chips" role="group" aria-label="Report period">
        @for (p of periods; track p) {
          <button type="button" class="chip" [class.on]="period() === p" (click)="period.set(p)">{{ labels[p] }}</button>
        }
      </div>
      @if (period() === 'custom') {
        <div class="range">
          <div class="field">
            <label for="r-from">Start date</label>
            <input id="r-from" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
          </div>
          <div class="field">
            <label for="r-to">End date</label>
            <input id="r-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
          </div>
        </div>
      }
    </section>

    <section class="stats">
      <div class="card kpi">
        <span class="kpi-label">Income</span>
        <strong class="kpi-value pos">{{ incomeTotal() | money }}</strong>
        <span class="kpi-sub">{{ incomeEntries().length }} {{ incomeEntries().length === 1 ? 'payment' : 'payments' }}</span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Expenses</span>
        <strong class="kpi-value">{{ total() | money }}</strong>
        <span class="kpi-sub">{{ spendEntries().length }} · avg {{ avgTx() | money }}</span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Net savings</span>
        <strong class="kpi-value" [class.pos]="netTotal() > 0" [class.neg]="netTotal() < 0">
          {{ netTotal() >= 0 ? '+' : '−' }}{{ abs(netTotal()) | money }}
        </strong>
        <span class="kpi-sub">
          @if (savings() !== null) { {{ savings() | number: '1.0-0' }}% savings rate } @else { No income in period }
        </span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Spent per day</span>
        <strong class="kpi-value">{{ perDay() | money }}</strong>
        <span class="kpi-sub">Over {{ days() }} {{ days() === 1 ? 'day' : 'days' }}</span>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Cash flow</h2>
        <span class="muted small">Last 12 months</span>
      </div>
      <app-cashflow-chart [data]="cashflow()" [height]="200" label="Income vs expenses, last 12 months" />
    </section>

    <section class="card">
      <div class="card-head">
        <h2>By category</h2>
        <div class="segmented" role="radiogroup" aria-label="Category breakdown type">
          <button type="button" role="radio" [class.on]="catType() === 'expense'" [attr.aria-checked]="catType() === 'expense'" (click)="catType.set('expense')">Expenses</button>
          <button type="button" role="radio" [class.on]="catType() === 'income'" [attr.aria-checked]="catType() === 'income'" (click)="catType.set('income')">Income</button>
        </div>
      </div>
      @if (cats().length) {
        <ul class="cat-bars">
          @for (c of cats(); track c.category.id) {
            <li>
              <div class="cb-top">
                <span>{{ c.category.icon }} {{ c.category.label }} <em>· {{ c.count }}</em></span>
                <span><strong>{{ c.total | money }}</strong> <em>{{ c.pct.toFixed(1) }}%</em></span>
              </div>
              <div class="track"><div class="bar" [style.width.%]="(c.total / cats()[0].total) * 100" [style.background]="c.category.color"></div></div>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">No {{ catType() === 'income' ? 'income' : 'expenses' }} in this period.</p>
      }
    </section>

    <div class="grid-2">
      <section class="card">
        <div class="card-head">
          <h2>Spending by weekday</h2>
          <span class="muted small">{{ labels[period()] }}</span>
        </div>
        <app-bar-chart [data]="weekday()" [height]="180" label="Spending by day of week" />
      </section>
      <section class="card">
        <div class="card-head"><h2>Biggest expenses</h2></div>
        @if (top().length) {
          <div class="rows">
            @for (e of top(); track e.index) { <app-expense-row [entry]="e" [showDate]="true" /> }
          </div>
        } @else {
          <p class="muted">Nothing here yet.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .filters { display: flex; flex-direction: column; gap: 14px; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .range { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 480px) { .range { grid-template-columns: 1fr; } }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 1100px) { .stats { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .stats { gap: 10px; } }
    .kpi { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .card-head { align-items: center; }
    .card-head .segmented button { padding: 5px 12px; }
    .cat-bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .cb-top { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; margin-bottom: 6px; }
    .cb-top em { font-style: normal; color: var(--text-3); font-size: 12.5px; }
    .cb-top span:last-child { white-space: nowrap; }
    .cb-top span:last-child em { margin-left: 6px; display: inline-block; min-width: 42px; text-align: right; }
    .track { height: 10px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
    .bar { height: 100%; border-radius: 99px; transition: width .4s ease; }
    .rows { display: flex; flex-direction: column; margin: 0 -10px; }
  `,
})
export class ReportsPage {
  private readonly svc = inject(ExpenseService);
  protected readonly abs = Math.abs;

  protected readonly periods: Period[] = ['month', 'lastMonth', 'last3Months', 'year', 'all', 'custom'];
  protected readonly labels = PERIOD_LABELS;

  protected readonly period = signal<Period>('month');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly catType = signal<TxType>('expense');

  private readonly range = computed(() => periodRange(this.period(), this.from(), this.to()));
  protected readonly entries = computed(() => filterRange(this.svc.entries(), this.range()));
  protected readonly spendEntries = computed(() => spending(this.entries()));
  protected readonly incomeEntries = computed(() => incomes(this.entries()));
  protected readonly total = computed(() => sum(this.spendEntries()));
  protected readonly incomeTotal = computed(() => sum(this.incomeEntries()));
  protected readonly netTotal = computed(() => this.incomeTotal() - this.total());
  protected readonly savings = computed(() => savingsRate(this.incomeTotal(), this.total()));
  protected readonly avgTx = computed(() => this.total() / (this.spendEntries().length || 1));

  /** Number of days covered (capped at today, starting at first transaction for open ranges). */
  protected readonly days = computed(() => {
    const r = this.range();
    const list = this.entries();
    const now = new Date();
    const start = r.start ?? (list.length ? new Date(Math.min(...list.map((e) => e.time.getTime()))) : now);
    const end = r.end && r.end < now ? r.end : now;
    return Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000) + 1);
  });
  protected readonly perDay = computed(() => this.total() / this.days());

  protected readonly cats = computed(() =>
    byCategory(this.catType() === 'income' ? this.incomeEntries() : this.spendEntries()),
  );
  protected readonly cashflow = computed(() => cashflowSeries(this.svc.entries(), new Date(), 12));
  protected readonly weekday = computed(() => weekdaySeries(this.spendEntries()));
  protected readonly top = computed(() =>
    [...this.spendEntries()].sort((a, b) => b.expense.amount - a.expense.amount).slice(0, 5),
  );
}
