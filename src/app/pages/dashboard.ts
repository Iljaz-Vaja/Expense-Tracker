import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExpenseService } from '../services/expense.service';
import { SettingsService } from '../services/settings.service';
import { UiService } from '../services/ui.service';
import { MoneyPipe } from '../shared/money.pipe';
import { Icon } from '../shared/icon';
import { BarChart } from '../shared/bar-chart';
import { DonutChart } from '../shared/donut-chart';
import { ExpenseRow } from '../shared/expense-row';
import { addMonths, daysInMonth, endOfDay, periodRange } from '../utils/date';
import { byCategory, dailySeries, filterRange, foldCategories, sum } from '../utils/stats';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [MoneyPipe, Icon, BarChart, DonutChart, ExpenseRow, RouterLink, DecimalPipe, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ today | date: 'EEEE, MMMM d' }}</p>
        <h1>{{ greeting }}</h1>
      </div>
      <button class="btn btn-primary hide-mobile" (click)="ui.openAdd()">
        <app-icon name="plus" [size]="18" /> Add expense
      </button>
    </header>

    @if (!svc.entries().length) {
      <section class="card empty">
        <div class="empty-art">💸</div>
        <h2>Start tracking your spending</h2>
        <p>Add your first expense to see insights, budgets and charts here.</p>
        <button class="btn btn-primary" (click)="ui.openAdd()"><app-icon name="plus" [size]="18" /> Add first expense</button>
      </section>
    } @else {
      <section class="kpis">
        <div class="card kpi hero">
          <span class="kpi-label">Spent this month</span>
          <strong class="kpi-value">{{ monthTotal() | money }}</strong>
          @if (change() !== null && (change()! >= 1 || change()! <= -1)) {
            @let c = change()!;
            <span class="delta" [class.up]="c > 0" [class.down]="c < 0">
              <app-icon [name]="c > 0 ? 'up' : 'down'" [size]="14" />
              {{ (c > 0 ? c : -c) | number: '1.0-0' }}% vs same time last month
            </span>
          } @else {
            <span class="kpi-sub">{{ monthCount() }} transactions</span>
          }
        </div>
        <div class="card kpi">
          <span class="kpi-label">Today</span>
          <strong class="kpi-value">{{ todayTotal() | money }}</strong>
          <span class="kpi-sub">{{ todayCount() }} {{ todayCount() === 1 ? 'expense' : 'expenses' }}</span>
        </div>
        <div class="card kpi">
          <span class="kpi-label">Daily average</span>
          <strong class="kpi-value">{{ avgPerDay() | money }}</strong>
          <span class="kpi-sub">Projected {{ projected() | money: true }} this month</span>
        </div>
        <div class="card kpi">
          <span class="kpi-label">This week</span>
          <strong class="kpi-value">{{ weekTotal() | money }}</strong>
          <span class="kpi-sub">Since Monday</span>
        </div>
      </section>

      <section class="card budget">
        @if (budget() > 0) {
          <div class="budget-head">
            <div>
              <span class="kpi-label">Monthly budget</span>
              <p class="budget-line">
                <strong>{{ monthTotal() | money }}</strong> of {{ budget() | money }}
              </p>
            </div>
            <span class="status-pill" [class]="budgetStatus()">
              <app-icon [name]="budgetStatus() === 'good' ? 'check' : 'alert'" [size]="14" />
              @switch (budgetStatus()) {
                @case ('good') { On track }
                @case ('warning') { Close to limit }
                @default { Over budget }
              }
            </span>
          </div>
          <div class="progress" role="progressbar" [attr.aria-valuenow]="budgetPct()" aria-valuemin="0" aria-valuemax="100">
            <div class="fill" [class]="budgetStatus()" [style.width.%]="budgetPct() > 100 ? 100 : budgetPct()"></div>
            <div class="pace" [style.left.%]="monthProgress()" title="Where you'd be at an even pace"></div>
          </div>
          <p class="muted small">
            @if (remaining() >= 0) {
              {{ remaining() | money }} left · about {{ perDayLeft() | money }}/day for the remaining {{ daysLeft() }} days
            } @else {
              {{ -remaining() | money }} over budget
            }
          </p>
        } @else {
          <div class="budget-empty">
            <app-icon name="target" [size]="22" />
            <div>
              <strong>Set a monthly budget</strong>
              <p class="muted small">Get warned before you overspend.</p>
            </div>
            <a class="btn btn-ghost" routerLink="/settings">Set budget</a>
          </div>
        }
      </section>

      <div class="grid-2">
        <section class="card">
          <div class="card-head">
            <h2>Last 30 days</h2>
            <span class="muted small">{{ last30Total() | money }}</span>
          </div>
          <app-bar-chart [data]="daily()" [height]="170" label="Daily spending, last 30 days" [highlightLast]="true" />
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Where it went</h2>
            <span class="muted small">This month</span>
          </div>
          @if (categories().length) {
            <app-donut-chart [data]="categories()" />
          } @else {
            <p class="muted">No expenses this month yet.</p>
          }
        </section>
      </div>

      <section class="card">
        <div class="card-head">
          <h2>Recent transactions</h2>
          <a routerLink="/transactions" class="link">View all →</a>
        </div>
        <div class="rows">
          @for (e of recent(); track e.index) {
            <app-expense-row [entry]="e" [showDate]="true" />
          }
        </div>
      </section>
    }
  `,
  styles: `
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .kpis { gap: 10px; } }
    .kpi { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .hero { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; border: 0; }
    .hero .kpi-label, .hero .delta { color: rgba(255,255,255,.85); }
    .delta { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; }
    .budget-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .budget-line { margin: 4px 0 0; font-size: 15px; color: var(--text-2); }
    .budget-line strong { color: var(--text); font-size: 20px; }
    .progress { position: relative; height: 12px; border-radius: 99px; background: var(--surface-2); overflow: visible; }
    .fill { height: 100%; border-radius: 99px; transition: width .4s ease; }
    .fill.good { background: var(--good); } .fill.warning { background: var(--warning); } .fill.critical { background: var(--critical); }
    .pace { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--text-2); border-radius: 2px; }
    .budget-empty { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .budget-empty > div { flex: 1; min-width: 160px; }
    .budget-empty p { margin: 2px 0 0; }
    .rows { display: flex; flex-direction: column; margin: 0 -10px; }
    .empty { text-align: center; padding: 48px 24px; }
    .empty-art { font-size: 56px; }
    .empty p { color: var(--text-2); }
  `,
})
export class DashboardPage {
  protected readonly svc = inject(ExpenseService);
  protected readonly ui = inject(UiService);
  private readonly settings = inject(SettingsService);

  protected readonly today = new Date();
  protected readonly greeting = (() => {
    const h = this.today.getHours();
    return h < 12 ? 'Good morning 👋' : h < 18 ? 'Good afternoon 👋' : 'Good evening 👋';
  })();

  private readonly month = computed(() => filterRange(this.svc.entries(), periodRange('month')));
  protected readonly monthTotal = computed(() => sum(this.month()));
  protected readonly monthCount = computed(() => this.month().length);

  /** % change against the same number of days of last month. */
  protected readonly change = computed(() => {
    const start = addMonths(this.today, -1);
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), Math.min(this.today.getDate(), daysInMonth(start))));
    const prev = sum(filterRange(this.svc.entries(), { start, end }));
    return prev > 0 ? ((this.monthTotal() - prev) / prev) * 100 : null;
  });

  private readonly todayEntries = computed(() => filterRange(this.svc.entries(), periodRange('today')));
  protected readonly todayTotal = computed(() => sum(this.todayEntries()));
  protected readonly todayCount = computed(() => this.todayEntries().length);
  protected readonly weekTotal = computed(() => sum(filterRange(this.svc.entries(), periodRange('week'))));

  protected readonly avgPerDay = computed(() => this.monthTotal() / this.today.getDate());
  protected readonly projected = computed(() => this.avgPerDay() * daysInMonth(this.today));

  protected readonly budget = computed(() => Number(this.settings.settings().monthlyBudget) || 0);
  protected readonly budgetPct = computed(() => (this.monthTotal() / this.budget()) * 100);
  protected readonly remaining = computed(() => this.budget() - this.monthTotal());
  protected readonly daysLeft = computed(() => daysInMonth(this.today) - this.today.getDate() + 1);
  protected readonly perDayLeft = computed(() => Math.max(0, this.remaining()) / this.daysLeft());
  protected readonly monthProgress = computed(() => (this.today.getDate() / daysInMonth(this.today)) * 100);
  protected readonly budgetStatus = computed(() => {
    const pct = this.budgetPct();
    return pct > 100 ? 'critical' : pct >= 80 || this.projected() > this.budget() ? 'warning' : 'good';
  });

  protected readonly daily = computed(() => dailySeries(this.svc.entries(), this.today, 30));
  protected readonly last30Total = computed(() => this.daily().reduce((s, d) => s + d.value, 0));
  protected readonly categories = computed(() => foldCategories(byCategory(this.month()), 5));

  protected readonly recent = computed(() =>
    [...this.svc.entries()].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6),
  );
}
