import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../services/expense.service';
import { CURRENCIES, SettingsService, ThemeMode } from '../services/settings.service';
import { UiService } from '../services/ui.service';
import { Icon } from '../shared/icon';
import { MoneyPipe } from '../shared/money.pipe';
import { downloadFile, parseBackup, stamp, toCsv } from '../utils/export';

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
          <p class="muted small">Set 0 to turn budget tracking off.</p>
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

    <section class="card">
      <div class="card-head"><h2>Your data</h2></div>
      <div class="data-info">
        <div><span class="kpi-label">Records</span><strong>{{ count() }}</strong></div>
        <div><span class="kpi-label">All-time total</span><strong>{{ allTotal() | money }}</strong></div>
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
          <strong>Delete all expenses</strong>
          <p class="muted small">This can't be undone. Export a backup first.</p>
        </div>
        <button class="btn btn-danger" (click)="clearAll()" [disabled]="!count()"><app-icon name="trash" [size]="18" /> Delete all</button>
      </div>
    </section>

    <p class="muted small center">Expense Tracker v2.0 · Data stays on your device</p>
  `,
  styles: `
    .setting { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--border); flex-wrap: wrap; }
    .setting:first-of-type { border-top: 0; padding-top: 0; }
    .setting > div:first-child { flex: 1 1 220px; }
    .setting p { margin: 2px 0 0; }
    .setting select, .setting input { width: 220px; max-width: 100%; }
    .data-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px; }
    .data-info > div { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: var(--surface-2); border-radius: 12px; min-width: 0; }
    .data-info strong { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (max-width: 560px) { .data-info { grid-template-columns: 1fr; } }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .danger-zone { border-color: color-mix(in srgb, var(--critical) 35%, var(--border)); }
    .center { text-align: center; }
  `,
})
export class SettingsPage {
  protected readonly settings = inject(SettingsService);
  private readonly svc = inject(ExpenseService);
  private readonly ui = inject(UiService);

  protected readonly s = this.settings.settings;
  protected readonly currencies = CURRENCIES;
  protected readonly themes: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: 'Auto' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];

  protected readonly count = computed(() => this.svc.expenses().length);
  protected readonly allTotal = computed(() => this.svc.expenses().reduce((t, e) => t + (Number(e.amount) || 0), 0));
  protected readonly since = computed(() => {
    const times = this.svc.entries().map((e) => e.time.getTime());
    return times.length ? new Date(Math.min(...times)) : null;
  });

  protected exportJson() {
    const backup = {
      app: 'expense-tracker',
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: this.s(),
      expenses: this.svc.getExpenses(),
    };
    downloadFile(`expense-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
    this.ui.toast('Backup downloaded', { tone: 'success' });
  }

  protected exportCsv() {
    downloadFile(`expenses-${stamp()}.csv`, toCsv(this.svc.getExpenses()), 'text/csv;charset=utf-8');
    this.ui.toast('CSV exported', { tone: 'success' });
  }

  protected async importJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const list = parseBackup(await file.text());
    if (!list) {
      this.ui.toast('That file is not a valid backup', { tone: 'error' });
      return;
    }

    const current = this.svc.getExpenses();
    let merged = list;
    if (current.length) {
      const replace = confirm(
        `Backup contains ${list.length} expenses.\n\nOK = REPLACE your current ${current.length} expenses\nCancel = MERGE (keep current, add new ones)`,
      );
      if (!replace) {
        const sig = (e: { title: string; amount: number; date: string }) => `${e.title}|${Number(e.amount)}|${e.date}`;
        const existing = new Set(current.map(sig));
        merged = [...current, ...list.filter((e) => !existing.has(sig(e)))];
      }
    }
    this.svc.replaceAll(merged);
    this.ui.toast(`Restored — ${merged.length} expenses`, { tone: 'success' });
  }

  protected clearAll() {
    const all = this.svc.getExpenses();
    if (!confirm(`Delete all ${all.length} expenses? This cannot be undone.`)) return;
    this.svc.replaceAll([]);
    this.ui.toast('All expenses deleted', { action: { label: 'Undo', run: () => this.svc.replaceAll(all) } });
  }
}
