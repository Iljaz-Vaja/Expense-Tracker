import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ExpenseEntry } from '../models/expense';
import { getCategory } from '../models/category';
import { MoneyPipe } from './money.pipe';
import { Icon } from './icon';
import { UiService } from '../services/ui.service';

@Component({
  selector: 'app-expense-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe, DatePipe, Icon],
  template: `
    <div class="row">
      <button
        type="button"
        class="main"
        (click)="ui.openEdit(entry().index, entry().expense)"
        [attr.aria-label]="'Edit ' + entry().expense.title"
      >
        <span class="bubble" [style.--c]="cat().color">{{ cat().icon }}</span>
        <span class="text">
          <span class="title">{{ entry().expense.title }}</span>
          <span class="sub">
            {{ cat().label }} ·
            {{ entry().time | date: (showDate() ? 'MMM d, HH:mm' : 'HH:mm') }}
            @if (entry().expense.note) {
              · <span class="note">{{ entry().expense.note }}</span>
            }
          </span>
        </span>
        <span class="amt">−{{ entry().expense.amount | money }}</span>
      </button>
      <div class="actions">
        <button type="button" class="icon-btn sm" (click)="ui.duplicate(entry().expense)" title="Duplicate" aria-label="Duplicate">
          <app-icon name="copy" [size]="16" />
        </button>
        <button type="button" class="icon-btn sm danger" (click)="ui.deleteWithUndo(entry().index)" title="Delete" aria-label="Delete">
          <app-icon name="trash" [size]="16" />
        </button>
      </div>
    </div>
  `,
  styles: `
    .row { display: flex; align-items: center; gap: 4px; border-radius: 12px; transition: background .15s; }
    .row:hover { background: var(--surface-2); }
    .main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 12px; }
    .main:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .bubble { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 19px; flex-shrink: 0; background: color-mix(in srgb, var(--c) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 30%, transparent); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { font-size: 12.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .amt { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .actions { display: flex; gap: 2px; padding-right: 6px; opacity: 0; transition: opacity .15s; }
    .row:hover .actions, .row:focus-within .actions { opacity: 1; }
    @media (hover: none) { .actions { opacity: 1; } }
  `,
})
export class ExpenseRow {
  readonly entry = input.required<ExpenseEntry>();
  readonly showDate = input(false);
  protected readonly ui = inject(UiService);
  protected readonly cat = computed(() => getCategory(this.entry().expense.category));
}
