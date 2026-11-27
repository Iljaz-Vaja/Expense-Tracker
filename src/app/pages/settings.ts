import { ChangeDetectionStrategy, Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ExpenseService } from '../services/expense.service';
import { CURRENCIES, SettingsService, ThemeMode } from '../services/settings.service';
import { UiService } from '../services/ui.service';
import { Category, defaultCategoryOf } from '../models/category';
import { TxType, txType } from '../models/expense';
import { Icon } from '../shared/icon';
import { MoneyPipe } from '../shared/money.pipe';
import { incomes, spending, sum } from '../utils/stats';
import { downloadFile, parseBackup, stamp, toCsv } from '../utils/export';

const EMOJI_SUGGESTIONS: Record<TxType, string[]> = {
  expense: ['🏷️', '☕', '🍺', '🐶', '👶', '🎓', '📱', '🎮', '💇', '🏋️', '🚬', '🎁', '⛽', '🅿️', '🧾', '🔧'],
  income: ['🏷️', '💵', '🏦', '🪙', '📊', '🧑‍💻', '🏆', '🤝', '📦', '🎨', '🚕', '🧾'],
};

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [FormsModule, Icon, DatePipe, MoneyPipe],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">Preferences & data</p>
        <h1>Settings</h1>
      </div>
    </header>

    <section class="card">
      <div class="card-head"><h2>General</h2></div>
      <div class="setting">
        <div>
          <strong>Currency</strong>
          <p class="muted small">Only changes how amounts are shown.</p>
        </div>
        <select [ngModel]="s().currency" (ngModelChange)="settings.update({ currency: $event })" aria-label="Currency">
          @for (c of currencies; track c.code) { <option [value]="c.code">{{ c.code }} ({{ c.symbol }})</option> }
        </select>
      </div>
      <div class="setting">
        <div>
          <strong>Monthly budget</strong>
          <p class="muted small">Spending limit per month. Set 0 to turn budget tracking off.</p>
        </div>
        <input
          type="number"
          inputmode="decimal"
          min="0"
          step="100"
          aria-label="Monthly budget"
          [ngModel]="s().monthlyBudget || null"
          (ngModelChange)="settings.update({ monthlyBudget: $event > 0 ? +$event : 0 })"
          [ngModelOptions]="{ updateOn: 'blur' }"
          placeholder="e.g. 50000"
        />
      </div>
      <div class="setting">
        <div>
          <strong>Appearance</strong>
          <p class="muted small">Follow your device or pick a theme.</p>
        </div>
        <div class="segmented" role="radiogroup" aria-label="Theme">
          @for (t of themes; track t.id) {
            <button type="button" role="radio" [attr.aria-checked]="s().theme === t.id" [class.on]="s().theme === t.id" (click)="settings.update({ theme: t.id })">
              {{ t.label }}
            </button>
          }
        </div>
      </div>
    </section>

    <section class="card" id="categories">
      <div class="card-head cat-head">
        <div>
          <h2>Categories</h2>
          <p class="muted small">Choose which categories appear when you add a transaction. Hiding one keeps its history in reports.</p>
        </div>
        <div class="type-toggle" role="radiogroup" aria-label="Category type">
          <button type="button" role="radio" class="expense" [class.on]="catType() === 'expense'" [attr.aria-checked]="catType() === 'expense'" (click)="setCatType('expense')">
            <app-icon name="out" [size]="16" /> Expenses
          </button>
          <button type="button" role="radio" class="income" [class.on]="catType() === 'income'" [attr.aria-checked]="catType() === 'income'" (click)="setCatType('income')">
            <app-icon name="in" [size]="16" /> Income
          </button>
        </div>
      </div>

      <div class="cat-tools">
        <span class="muted small">{{ visibleCount() }} of {{ catList().length }} shown</span>
        <span class="spacer"></span>
        <button type="button" class="link small" (click)="setAll(true)">Show all</button>
        <button type="button" class="link small" (click)="setAll(false)">Hide all</button>
      </div>

      <ul class="cat-list">
        @for (c of catList(); track c.id) {
          @let locked = c.id === fallback();
          <li [class.off]="settings.isHidden(c.id) && !locked">
            <span class="bubble" [style.--c]="c.color">{{ c.icon }}</span>
            <span class="name">
              {{ c.label }}
              @if (c.custom) { <em class="tag">Custom</em> }
              @if (locked) { <em class="tag">Always shown</em> }
              <span class="muted small">{{ usage().get(c.id) ?? 0 }} transactions</span>
            </span>
            @if (c.custom) {
              <button type="button" class="icon-btn sm danger" (click)="removeCategory(c)" [attr.aria-label]="'Delete ' + c.label" title="Delete category">
                <app-icon name="trash" [size]="16" />
              </button>
            }
            <label class="switch" [title]="locked ? 'The catch-all category is always available' : ''">
              <input
                type="checkbox"
                [checked]="locked || !settings.isHidden(c.id)"
                [disabled]="locked"
                (change)="toggle(c, $event)"
                [attr.aria-label]="'Show ' + c.label"
              />
              <span class="track"></span>
            </label>
          </li>
        }
      </ul>

      <form class="add-cat" (ngSubmit)="addCategory()">
        <div class="emoji-pick">
          <input
            class="emoji-input"
            name="icon"
            maxlength="8"
            aria-label="Category icon (emoji)"
            [ngModel]="newIcon()"
            (ngModelChange)="newIcon.set($event)"
          />
        </div>
        <input
          name="label"
          maxlength="30"
          [placeholder]="catType() === 'income' ? 'New income category, e.g. Bonus' : 'New expense category, e.g. Pets'"
          aria-label="New category name"
          [ngModel]="newLabel()"
          (ngModelChange)="newLabel.set($event)"
        />
        <button type="submit" class="btn btn-primary" [disabled]="!newLabel().trim()">
          <app-icon name="plus" [size]="18" /> Add
        </button>
      </form>
      <div class="emoji-row" role="group" aria-label="Suggested icons">
        @for (e of emojis(); track e) {
          <button type="button" class="emoji-btn" [class.on]="newIcon() === e" (click)="newIcon.set(e)">{{ e }}</button>
        }
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Your data</h2></div>
      <div class="data-info">
        <div><span class="kpi-label">Records</span><strong>{{ count() }}</strong></div>
        <div><span class="kpi-label">Total income</span><strong class="pos">{{ incomeTotal() | money }}</strong></div>
        <div><span class="kpi-label">Total expenses</span><strong>{{ allTotal() | money }}</strong></div>
        <div><span class="kpi-label">Tracking since</span><strong>{{ since() ? (since() | date: 'mediumDate') : '—' }}</strong></div>
      </div>
      <p class="muted small">Your data is stored only on this device (browser storage). Export a backup regularly, especially before clearing browser data or switching devices.</p>
      <div class="btn-row">
        <button class="btn btn-ghost" (click)="exportJson()" [disabled]="!count()"><app-icon name="download" [size]="18" /> Backup (JSON)</button>
        <button class="btn btn-ghost" (click)="exportCsv()" [disabled]="!count()"><app-icon name="download" [size]="18" /> Export CSV</button>
        <label class="btn btn-ghost">
          <app-icon name="upload" [size]="18" /> Restore backup
          <input type="file" accept="application/json,.json" (change)="importJson($event)" hidden />
        </label>
      </div>
    </section>

    <section class="card danger-zone">
      <div class="card-head"><h2>Danger zone</h2></div>
      <div class="setting">
        <div>
          <strong>Delete all transactions</strong>
          <p class="muted small">Removes all income and expenses. Export a backup first.</p>
        </div>
        <button class="btn btn-danger" (click)="clearAll()" [disabled]="!count()"><app-icon name="trash" [size]="18" /> Delete all</button>
      </div>
    </section>

    <p class="muted small center">Expense Tracker v3.0 · Data stays on your device</p>
  `,
  styles: `
    .setting { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--border); flex-wrap: wrap; }
    .setting:first-of-type { border-top: 0; padding-top: 0; }
    .setting > div:first-child { flex: 1 1 220px; }
    .setting p { margin: 2px 0 0; }
    .setting select, .setting input { width: 220px; max-width: 100%; }
    .cat-head { flex-wrap: wrap; align-items: flex-start; }
    .cat-head > div:first-child { flex: 1 1 260px; }
    .cat-head p { margin: 4px 0 0; }
    .cat-head .type-toggle { flex: 0 0 auto; min-width: 240px; }
    @media (max-width: 560px) { .cat-head .type-toggle { width: 100%; } }
    .cat-tools { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
    .spacer { flex: 1; }
    .cat-list { list-style: none; margin: 0 -8px; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 12px; }
    @media (max-width: 720px) { .cat-list { grid-template-columns: minmax(0, 1fr); } }
    .cat-list li { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 12px; transition: background .15s, opacity .15s; }
    .cat-list li:hover { background: var(--surface-2); }
    .cat-list li.off .bubble, .cat-list li.off .name { opacity: .45; }
    .bubble { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; font-size: 18px; flex-shrink: 0; background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent); }
    .name { flex: 1; min-width: 0; display: flex; flex-direction: column; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name .small { font-weight: 400; font-size: 12px; }
    .tag { font-style: normal; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); margin-left: 6px; }
    .add-cat { display: flex; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
    .add-cat input[name='label'] { flex: 1; min-width: 0; }
    .emoji-input { width: 52px !important; text-align: center; font-size: 20px !important; padding: 8px 4px !important; }
    .emoji-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
    .emoji-btn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid transparent; background: var(--surface-2); font-size: 17px; cursor: pointer; display: grid; place-items: center; padding: 0; }
    .emoji-btn:hover { border-color: var(--text-3); }
    .emoji-btn.on { border-color: var(--accent); background: var(--accent-soft); }
    .data-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }
    .data-info > div { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: var(--surface-2); border-radius: 12px; min-width: 0; }
    .data-info strong { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 720px) { .data-info { grid-template-columns: 1fr 1fr; } }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .danger-zone { border-color: color-mix(in srgb, var(--critical) 35%, var(--border)); }
    .center { text-align: center; }
  `,
})
export class SettingsPage {
  protected readonly settings = inject(SettingsService);
  private readonly svc = inject(ExpenseService);
  private readonly ui = inject(UiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly s = this.settings.settings;
  protected readonly currencies = CURRENCIES;
  protected readonly themes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  // ---------- Categories ----------
  protected readonly catType = signal<TxType>('expense');
  protected readonly newLabel = signal('');
  protected readonly newIcon = signal('🏷️');
  protected readonly fallback = computed(() => defaultCategoryOf(this.catType()));
  protected readonly emojis = computed(() => EMOJI_SUGGESTIONS[this.catType()]);

  /** Every category of the selected type, visible or not. */
  protected readonly catList = computed(() => {
    this.s();
    return this.settings.categoriesFor(this.catType());
  });
  protected readonly visibleCount = computed(() => {
    const hidden = new Set(this.s().hiddenCategories);
    return this.catList().filter((c) => c.id === this.fallback() || !hidden.has(c.id)).length;
  });
  protected readonly usage = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.svc.expenses()) {
      const id = e.category ?? defaultCategoryOf(txType(e));
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  });

  // ---------- Data ----------
  protected readonly count = computed(() => this.svc.expenses().length);
  protected readonly allTotal = computed(() => sum(spending(this.svc.entries())));
  protected readonly incomeTotal = computed(() => sum(incomes(this.svc.entries())));
  protected readonly since = computed(() => {
    const times = this.svc.entries().map((e) => e.time.getTime());
    return times.length ? new Date(Math.min(...times)) : null;
  });

  constructor() {
    afterNextRender(() => {
      if (this.route.snapshot.fragment === 'categories') {
        document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  protected setCatType(t: TxType) {
    this.catType.set(t);
    this.newIcon.set('🏷️');
  }

  protected toggle(c: Category, event: Event) {
    this.settings.setHidden(c.id, !(event.target as HTMLInputElement).checked);
  }

  protected setAll(show: boolean) {
    const ids = new Set(this.catList().map((c) => c.id));
    const others = this.s().hiddenCategories.filter((id) => !ids.has(id));
    this.settings.update({
      hiddenCategories: show ? others : [...others, ...[...ids].filter((id) => id !== this.fallback())],
    });
  }

  protected addCategory() {
    const label = this.newLabel().trim();
    if (!label) return;
    const exists = this.catList().some((c) => c.label.toLowerCase() === label.toLowerCase());
    if (exists) {
      this.ui.toast(`“${label}” already exists`, { tone: 'error' });
      return;
    }
    this.settings.addCustomCategory(label, this.newIcon().trim() || '🏷️', this.catType());
    this.newLabel.set('');
    this.newIcon.set('🏷️');
    this.ui.toast(`Category “${label}” added`, { tone: 'success' });
  }

  protected removeCategory(c: Category) {
    const used = this.usage().get(c.id) ?? 0;
    const fallbackLabel = this.catType() === 'income' ? 'Other income' : 'Other';
    const msg = used
      ? `Delete “${c.label}”? Its ${used} transactions will show under “${fallbackLabel}”.`
      : `Delete “${c.label}”?`;
    if (!confirm(msg)) return;
    const before = this.s();
    this.settings.removeCustomCategory(c.id);
    this.ui.toast(`Deleted “${c.label}”`, {
      action: {
        label: 'Undo',
        run: () =>
          this.settings.update({
            customCategories: before.customCategories,
            hiddenCategories: before.hiddenCategories,
          }),
      },
    });
  }

  // ---------- Backup ----------
  protected exportJson() {
    const backup = {
      app: 'expense-tracker',
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: this.s(),
      expenses: this.svc.getExpenses(),
    };
    downloadFile(`finance-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    this.ui.toast('Backup downloaded', { tone: 'success' });
  }

  protected exportCsv() {
    downloadFile(`transactions-${stamp()}.csv`, toCsv(this.svc.getExpenses()), 'text/csv;charset=utf-8');
    this.ui.toast('CSV exported', { tone: 'success' });
  }

  protected async importJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const backup = parseBackup(await file.text());
    if (!backup) {
      this.ui.toast('That file is not a valid backup', { tone: 'error' });
      return;
    }
    const list = backup.expenses;

    const current = this.svc.getExpenses();
    let merged = list;
    if (current.length) {
      const replace = confirm(
        `Backup contains ${list.length} transactions.\n\nOK = REPLACE your current ${current.length} transactions\nCancel = MERGE (keep current, add new ones)`,
      );
      if (!replace) {
        const sig = (e: { title: string; amount: number; date: string; type?: string }) =>
          `${e.title}|${Number(e.amount)}|${e.date}|${e.type ?? ''}`;
        const existing = new Set(current.map(sig));
        merged = [...current, ...list.filter((e) => !existing.has(sig(e)))];
      }
    }
    this.settings.mergeCustomCategories(backup.customCategories);
    this.svc.replaceAll(merged);
    this.ui.toast(`Restored — ${merged.length} transactions`, { tone: 'success' });
  }

  protected clearAll() {
    const all = this.svc.getExpenses();
    if (!confirm(`Delete all ${all.length} transactions? This cannot be undone.`)) return;
    this.svc.replaceAll([]);
    this.ui.toast('All transactions deleted', { action: { label: 'Undo', run: () => this.svc.replaceAll(all) } });
  }
}
