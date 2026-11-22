import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExpenseService } from './services/expense.service';
import { SettingsService, ThemeMode } from './services/settings.service';
import { UiService } from './services/ui.service';
import { ExpenseForm } from './shared/expense-form';
import { Toasts } from './shared/toasts';
import { Icon } from './shared/icon';
import { MoneyPipe } from './shared/money.pipe';
import { filterRange, sum } from './utils/stats';
import { periodRange } from './utils/date';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ExpenseForm, Toasts, Icon, MoneyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class App {
  protected readonly ui = inject(UiService);
  private readonly svc = inject(ExpenseService);
  private readonly settings = inject(SettingsService);

  /**
   * Data lives in localStorage (browser only). Pages render after hydration so the
   * pre-rendered HTML and the client never disagree.
   */
  protected readonly ready = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Dashboard', icon: 'home', exact: true },
    { path: '/transactions', label: 'Transactions', icon: 'list', exact: false },
    { path: '/reports', label: 'Reports', icon: 'chart', exact: false },
    { path: '/settings', label: 'Settings', icon: 'settings', exact: false },
  ];

  protected readonly monthTotal = computed(() => sum(filterRange(this.svc.entries(), periodRange('month'))));
  protected readonly budget = computed(() => Number(this.settings.settings().monthlyBudget) || 0);
  protected readonly budgetPct = computed(() => Math.min(100, (this.monthTotal() / (this.budget() || 1)) * 100));
  protected readonly theme = computed(() => this.settings.settings().theme);

  constructor() {
    afterNextRender(() => this.ready.set(true));
  }

  protected cycleTheme() {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(this.theme()) + 1) % order.length];
    this.settings.update({ theme: next });
    this.ui.toast(`Theme: ${next === 'system' ? 'Auto' : next[0].toUpperCase() + next.slice(1)}`);
  }

  /** Keyboard shortcut: press N to add an expense. */
  protected onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (e.ctrlKey || e.metaKey || e.altKey || this.ui.form()) return;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      this.ui.openAdd();
    }
  }
}
