import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { defaultCategoryOf, getCategory } from '../models/category';
import { Expense, TxType, txType } from '../models/expense';
import { ExpenseService } from '../services/expense.service';
import { SettingsService } from '../services/settings.service';
import { FormState, UiService } from '../services/ui.service';
import { toLocalInput } from '../utils/date';
import { Icon } from './icon';

@Component({
  selector: 'app-expense-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (state(); as s) {
      <div class="overlay" (click)="close()"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <header class="sheet-head">
          <h2 id="form-title">{{ s.index === null ? 'New' : 'Edit' }} {{ type() === 'income' ? 'income' : 'expense' }}</h2>
          <button type="button" class="icon-btn" (click)="close()" aria-label="Close">
            <app-icon name="close" />
          </button>
        </header>

        <form (ngSubmit)="save(false)" novalidate>
          <div class="type-toggle" role="radiogroup" aria-label="Transaction type">
            <button type="button" role="radio" class="expense" [class.on]="type() === 'expense'" [attr.aria-checked]="type() === 'expense'" (click)="setType('expense')">
              <app-icon name="out" [size]="16" /> Expense
            </button>
            <button type="button" role="radio" class="income" [class.on]="type() === 'income'" [attr.aria-checked]="type() === 'income'" (click)="setType('income')">
              <app-icon name="in" [size]="16" /> Income
            </button>
          </div>

          <label class="amount-field" [class.income]="type() === 'income'" [class.invalid]="submitted() && !amountValid()">
            @if (cur.prefix) { <span class="cur">{{ cur.symbol }}</span> }
            <input
              #amountInput
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              name="amount"
              placeholder="0"
              aria-label="Amount"
              [ngModel]="amount()"
              (ngModelChange)="amount.set($event)"
            />
            @if (!cur.prefix) { <span class="cur">{{ cur.symbol }}</span> }
          </label>
          @if (submitted() && !amountValid()) {
            <p class="err">Enter an amount greater than 0</p>
          }

          <div class="field">
            <label for="f-title">Title</label>
            <input
              id="f-title"
              name="title"
              list="title-suggestions"
              autocomplete="off"
              maxlength="80"
              [placeholder]="type() === 'income' ? 'e.g. Salary, Client payment' : 'e.g. Groceries, Coffee, Fuel'"
              [class.invalid]="submitted() && !title().trim()"
              [ngModel]="title()"
              (ngModelChange)="onTitle($event)"
            />
            <datalist id="title-suggestions">
              @for (t of suggestions(); track t) { <option [value]="t"></option> }
            </datalist>
            @if (submitted() && !title().trim()) { <p class="err">Give this transaction a title</p> }
          </div>

          <div class="field">
            <div class="label-row">
              <span class="label" id="cat-label">Category</span>
              <button type="button" class="link small" (click)="manageCategories()">Manage</button>
            </div>
            <div class="cat-grid" role="radiogroup" aria-labelledby="cat-label">
              @for (c of categories(); track c.id) {
                <button
                  type="button"
                  role="radio"
                  class="cat-chip"
                  [style.--c]="c.color"
                  [class.selected]="category() === c.id"
                  [attr.aria-checked]="category() === c.id"
                  (click)="pickCategory(c.id)"
                >
                  <span class="emoji">{{ c.icon }}</span>
                  <span>{{ c.label }}</span>
                </button>
              }
            </div>
          </div>

          <div class="field">
            <label for="f-date">Date & time</label>
            <div class="date-row">
              <input
                id="f-date"
                type="datetime-local"
                name="date"
                [class.invalid]="submitted() && !dateValid()"
                [ngModel]="date()"
                (ngModelChange)="date.set($event)"
              />
              <button type="button" class="chip" (click)="setDay(0)">Today</button>
              <button type="button" class="chip" (click)="setDay(-1)">Yesterday</button>
            </div>
            @if (submitted() && !dateValid()) { <p class="err">Pick a valid date</p> }
          </div>

          <div class="field">
            <label for="f-note">Note <span class="opt">(optional)</span></label>
            <textarea
              id="f-note"
              name="note"
              rows="2"
              maxlength="200"
              placeholder="Add details…"
              [ngModel]="note()"
              (ngModelChange)="note.set($event)"
            ></textarea>
          </div>

          <footer class="sheet-foot">
            @if (s.index !== null) {
              <button type="button" class="btn btn-ghost danger" (click)="remove(s)">
                <app-icon name="trash" [size]="18" /> Delete
              </button>
            } @else {
              <button type="button" class="btn btn-ghost" (click)="save(true)">Save & add another</button>
            }
            <button type="submit" class="btn btn-primary">
              <app-icon name="check" [size]="18" /> {{ s.index !== null ? 'Save changes' : type() === 'income' ? 'Add income' : 'Add expense' }}
            </button>
          </footer>
        </form>
      </div>
    }
  `,
  styles: `
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); z-index: 100; animation: fade .15s ease-out; }
    .sheet { position: fixed; z-index: 101; background: var(--surface); color: var(--text); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; overflow: hidden;
      left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(560px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); border-radius: 20px; animation: pop .18s ease-out; }
    @media (max-width: 640px) {
      .sheet { left: 0; right: 0; top: auto; bottom: 0; transform: none; width: 100%; max-height: 92dvh; border-radius: 20px 20px 0 0; animation: up .22s ease-out; }
    }
    .sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 4px; }
    .sheet-head h2 { margin: 0; font-size: 18px; }
    form { padding: 8px 20px 0; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
    .amount-field { display: flex; align-items: baseline; justify-content: center; gap: 8px; padding: 14px; border-radius: 16px; background: var(--surface-2); border: 2px solid transparent; }
    .amount-field:focus-within { border-color: var(--accent); }
    .amount-field.invalid { border-color: var(--critical); }
    .amount-field.income input, .amount-field.income .cur { color: var(--income); }
    .label-row { display: flex; justify-content: space-between; align-items: baseline; }
    .label-row .label { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .label-row .link { font-size: 13px; }
    .amount-field input { all: unset; font-size: 40px; font-weight: 700; letter-spacing: -.02em; max-width: 260px; text-align: center; font-variant-numeric: tabular-nums; field-sizing: content; min-width: 1.2ch; }
    @supports not (field-sizing: content) { .amount-field input { width: 100%; } }
    .amount-field input::-webkit-outer-spin-button, .amount-field input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .cur { font-size: 22px; font-weight: 600; color: var(--text-2); }
    .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    @media (max-width: 420px) { .cat-grid { grid-template-columns: repeat(2, 1fr); } }
    .cat-chip { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; text-align: left; transition: border-color .15s, background .15s; min-width: 0; }
    .cat-chip span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cat-chip:hover { border-color: var(--text-3); }
    .cat-chip.selected { border-color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--surface)); font-weight: 600; box-shadow: inset 0 0 0 1px var(--c); }
    .emoji { font-size: 17px; }
    .date-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .date-row input { flex: 1 1 200px; }
    @media (max-width: 640px) { .date-row input { flex-basis: 100%; } }
    .opt { color: var(--text-3); font-weight: 400; }
    .err { color: var(--critical); font-size: 12.5px; margin: -8px 0 0; }
    .field .err { margin: 2px 0 0; }
    .sheet-foot { position: sticky; bottom: 0; display: flex; justify-content: space-between; gap: 10px; padding: 14px 0 calc(16px + env(safe-area-inset-bottom)); background: var(--surface); border-top: 1px solid var(--border); margin-top: 4px; }
    .sheet-foot .btn-primary { flex: 1; max-width: 260px; margin-left: auto; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.98); } }
    @keyframes up { from { transform: translateY(100%); } }
  `,
})
export class ExpenseForm {
  private readonly ui = inject(UiService);
  private readonly svc = inject(ExpenseService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  protected readonly state = this.ui.form;
  protected get cur() {
    return this.settings.currency;
  }

  protected readonly amount = signal<number | null>(null);
  protected readonly title = signal('');
  protected readonly type = signal<TxType>('expense');
  protected readonly category = signal(defaultCategoryOf('expense'));
  protected readonly date = signal('');
  protected readonly note = signal('');
  protected readonly submitted = signal(false);
  private categoryTouched = false;

  private readonly amountInput = viewChild<ElementRef<HTMLInputElement>>('amountInput');

  protected readonly amountValid = computed(() => (Number(this.amount()) || 0) > 0);
  protected readonly dateValid = computed(() => !isNaN(new Date(this.date()).getTime()));

  /** Categories the user chose to show, plus the current one if it is hidden (editing). */
  protected readonly categories = computed(() => {
    this.settings.settings();
    const list = this.settings.visibleCategories(this.type());
    const cur = getCategory(this.category(), this.type());
    return list.some((c) => c.id === cur.id) || cur.type !== this.type() ? list : [...list, cur];
  });

  /** Previous titles (most used first) + the category last used with each. */
  private readonly history = computed(() => {
    const counts = new Map<string, { title: string; n: number; category?: string }>();
    const type = this.type();
    for (const e of this.svc.expenses()) {
      if (txType(e) !== type) continue;
      const key = e.title.trim().toLowerCase();
      if (!key) continue;
      const cur = counts.get(key) ?? { title: e.title.trim(), n: 0 };
      cur.n++;
      if (e.category) cur.category = e.category;
      counts.set(key, cur);
    }
    return counts;
  });
  protected readonly suggestions = computed(() =>
    [...this.history().values()].sort((a, b) => b.n - a.n).slice(0, 40).map((h) => h.title),
  );

  constructor() {
    effect(() => {
      const s = this.state();
      if (!s) return;
      untracked(() => this.reset(s.initial));
      setTimeout(() => this.amountInput()?.nativeElement.focus(), 50);
    });
  }

  private reset(init: Partial<Expense>) {
    this.amount.set(init.amount ?? null);
    this.title.set(init.title ?? '');
    const type = txType(init);
    this.type.set(type);
    this.category.set(init.category ?? defaultCategoryOf(type));
    this.date.set(init.date ? toInputValue(init.date) : toLocalInput(new Date()));
    this.note.set(init.note ?? '');
    this.submitted.set(false);
    this.categoryTouched = !!init.category;
  }

  protected onTitle(value: string) {
    this.title.set(value);
    if (this.categoryTouched) return;
    const known = this.history().get(value.trim().toLowerCase());
    if (known?.category) this.category.set(known.category);
  }

  protected setType(type: TxType) {
    if (type === this.type()) return;
    this.type.set(type);
    if (getCategory(this.category(), type).type !== type || !this.categoryTouched) {
      this.category.set(defaultCategoryOf(type));
      this.categoryTouched = false;
      this.onTitle(this.title());
    }
  }

  protected manageCategories() {
    this.close();
    this.router.navigate(['/settings'], { fragment: 'categories' });
  }

  protected pickCategory(id: string) {
    this.category.set(id);
    this.categoryTouched = true;
  }

  protected setDay(offset: number) {
    const current = new Date(this.date());
    const base = isNaN(current.getTime()) ? new Date() : current;
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, base.getHours(), base.getMinutes());
    this.date.set(toLocalInput(d));
  }

  protected save(addAnother: boolean) {
    this.submitted.set(true);
    const title = this.title().trim();
    if (!title || !this.amountValid() || !this.dateValid()) return;

    const s = this.state();
    const expense: Expense = {
      ...(s?.index !== null ? s?.initial : {}),
      title,
      amount: Math.round(Number(this.amount()) * 100) / 100,
      date: this.date(),
      category: this.category(),
      type: this.type(),
    };
    // Expenses are stored without `type` – identical to records from earlier versions.
    if (expense.type === 'expense') delete expense.type;
    const note = this.note().trim();
    if (note) expense.note = note;
    else delete expense.note;

    if (s && s.index !== null) {
      this.svc.updateExpense(s.index, expense);
      this.ui.toast('Transaction updated', { tone: 'success' });
      this.close();
      return;
    }

    this.svc.addExpense(expense);
    this.ui.toast(`Added “${title}”`, { tone: 'success' });

    if (addAnother) {
      // keep date & category, clear the rest
      this.amount.set(null);
      this.title.set('');
      this.note.set('');
      this.submitted.set(false);
      this.categoryTouched = false;
      this.amountInput()?.nativeElement.focus();
    } else {
      this.close();
    }
  }

  protected remove(s: FormState) {
    if (s.index === null) return;
    this.ui.deleteWithUndo(s.index);
    this.close();
  }

  protected close() {
    if (this.state()) this.ui.closeForm();
  }
}

/** Convert any stored date (ISO, datetime-local) to a datetime-local input value. */
function toInputValue(date: string): string {
  const d = new Date(date);
  return isNaN(d.getTime()) ? toLocalInput(new Date()) : toLocalInput(d);
}
