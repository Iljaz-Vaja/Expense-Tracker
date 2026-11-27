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
import { CashflowChart } from '../shared/cashflow-chart';
import { ExpenseRow } from '../shared/expense-row';
import { addMonths, daysInMonth, endOfDay, periodRange } from '../utils/date';
import {
  byCategory,
  cashflowSeries,
  dailySeries,
  filterRange,
  foldCategories,
  incomes,
  net,
  savingsRate,
  spending,
  sum,
} from '../utils/stats';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page' },
  imports: [MoneyPipe, Icon, BarChart, DonutChart, CashflowChart, ExpenseRow, RouterLink, DecimalPipe, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ today | date: 'EEEE, MMMM d' }}</p>
        <h1>{{ greeting }}</h1>
      </div>
      <div class="head-actions hide-mobile">
        <button class="btn btn-ghost" (click)="ui.openAdd({ type: 'income' })">
          <app-icon name="in" [size]="18" /> Add income
        </button>
        <button class="btn btn-primary" (click)="ui.openAdd()">
          <app-icon name="out" [size]="18" /> Add expense
        </button>
      </div>
    </header>

    @if (!svc.entries().length) {
      <section class="card empty">
        <div class="empty-art">💸</div>
        <h2>Take control of your money</h2>
        <p>Add your income and expenses to see your balance, cash flow and where your money goes.</p>
        <div class="empty-actions">
          <button class="btn btn-ghost" (click)="ui.openAdd({ type: 'income' })"><app-icon name="in" [size]="18" /> Add income</button>
          <button class="btn btn-primary" (click)="ui.openAdd()"><app-icon name="out" [size]="18" /> Add expense</button>
        </div>
      </section>
    } @else {
      <section class="kpis">
        <div class="card kpi hero">
          <span class="kpi-label">Total balance</span>
          <strong class="kpi-value">{{ balance() < 0 ? '−' : '' }}{{ abs(balance()) | money }}</strong>
          <span class="kpi-sub">
            This month {{ monthNet() >= 0 ? '+' : '−' }}{{ abs(monthNet()) | money }}
          </span>
        </div>
        <div class="card kpi">
          <span class="kpi-label"><span class="dot in"></span>Income</span>
          <strong class="kpi-value pos">{{ monthIncome() | money }}</strong>
          @if (incomeChange(); as c) {
            <span class="delta" [class.good]="c > 0" [class.bad]="c < 0">
              <app-icon [name]="c > 0 ? 'up' : 'down'" [size]="14" /> {{ abs(c) | number: '1.0-0' }}% vs last month
            </span>
          } @else {
            <span class="kpi-sub">This month</span>
          }
        </div>
        <div class="card kpi">
          <span class="kpi-label"><span class="dot out"></span>Expenses</span>
          <strong class="kpi-value">{{ monthTotal() | money }}</strong>
          @if (change(); as c) {
            <span class="delta" [class.bad]="c > 0" [class.good]="c < 0">
              <app-icon [name]="c > 0 ? 'up' : 'down'" [size]="14" /> {{ abs(c) | number: '1.0-0' }}% vs same time last month
            </span>
          } @else {
            <span class="kpi-sub">{{ monthCount() }} transactions this month</span>
          }
        </div>
        <div class="card kpi">
          <span class="kpi-label">Savings rate</span>
          @if (savings() !== null) {
            <strong class="kpi-value" [class.pos]="savings()! > 0" [class.neg]="savings()! < 0">{{ savings() | number: '1.0-0' }}%</strong>
            <span class="kpi-sub">{{ savings()! >= 20 ? 'Great job 🎉' : savings()! >= 0 ? 'Of income kept this month' : 'Spending more than you earn' }}</span>
          } @else {
            <strong class="kpi-value muted">—</strong>
            <span class="kpi-sub">Add income to see it</span>
          }
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
            <h2>Cash flow</h2>
            <span class="muted small">Last 6 months</span>
          </div>
          <app-cashflow-chart [data]="cashflow()" [height]="170" label="Income vs expenses, last 6 months" />
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

      <div class="grid-2">
        <section class="card">
          <div class="card-head">
            <h2>Daily spending</h2>
            <span class="muted small">30 days · {{ last30Total() | money }}</span>
          </div>
          <app-bar-chart [data]="daily()" [height]="170" label="Daily spending, last 30 days" [highlightLast]="true" />
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Income sources</h2>
            <span class="muted small">This month</span>
          </div>
          @if (incomeCategories().length) {
            <app-donut-chart [data]="incomeCategories()" />
          } @else {
            <div class="mini-empty">
              <app-icon name="piggy" [size]="28" />
              <p class="muted">No income recorded this month.</p>
              <button class="btn btn-ghost" (click)="ui.openAdd({ type: 'income' })"><app-icon name="in" [size]="18" /> Add income</button>
            </div>
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
    .head-actions { display: flex; gap: 8px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .kpis { gap: 10px; } }
    .kpi { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .kpi-label { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.in { background: var(--income); } .dot.out { background: var(--expense); }
    .hero { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; border: 0; }
    .hero .kpi-label, .hero .kpi-sub { color: rgba(255,255,255,.85); }
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
    .empty-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .mini-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px 0; text-align: center; color: var(--income); }
    .mini-empty p { margin: 0 0 6px; }
  `,
})
export class DashboardPage {
  protected readonly svc = inject(ExpenseService);
  protected readonly ui = inject(UiService);
  private readonly settings = inject(SettingsService);
  protected readonly abs = Math.abs;

  protected readonly today = new Date();
  protected readonly greeting = (() => {
    const h = this.today.getHours();
    return h < 12 ? 'Good morning 👋' : h < 18 ? 'Good afternoon 👋' : 'Good evening 👋';
  })();

  protected readonly balance = computed(() => net(this.svc.entries()));

  private readonly month = computed(() => filterRange(this.svc.entries(), periodRange('month')));
  private readonly monthSpend = computed(() => spending(this.month()));
  private readonly monthIn = computed(() => incomes(this.month()));
  protected readonly monthTotal = computed(() => sum(this.monthSpend()));
  protected readonly monthIncome = computed(() => sum(this.monthIn()));
  protected readonly monthNet = computed(() => this.monthIncome() - this.monthTotal());
  protected readonly monthCount = computed(() => this.monthSpend().length);
  protected readonly savings = computed(() => savingsRate(this.monthIncome(), this.monthTotal()));

  /** Same number of days of last month – a fair comparison mid-month. */
  private readonly lastMonthToDate = computed(() => {
    const start = addMonths(this.today, -1);
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), Math.min(this.today.getDate(), daysInMonth(start))));
    return filterRange(this.svc.entries(), { start, end });
  });

  /** % change in spending; null when there is nothing meaningful to compare. */
  protected readonly change = computed(() => pctChange(this.monthTotal(), sum(spending(this.lastMonthToDate()))));
  /** Income compares with the whole of last month (salaries land on fixed days). */
  protected readonly incomeChange = computed(() =>
    pctChange(this.monthIncome(), sum(incomes(filterRange(this.svc.entries(), periodRange('lastMonth'))))),
  );

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

  protected readonly cashflow = computed(() => cashflowSeries(this.svc.entries(), this.today, 6));
  protected readonly daily = computed(() => dailySeries(spending(this.svc.entries()), this.today, 30));
  protected readonly last30Total = computed(() => this.daily().reduce((s, d) => s + d.value, 0));
  protected readonly categories = computed(() => foldCategories(byCategory(this.monthSpend()), 5));
  protected readonly incomeCategories = computed(() => foldCategories(byCategory(this.monthIn()), 5));

  protected readonly recent = computed(() =>
    [...this.svc.entries()].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6),
  );
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  const c = ((current - previous) / previous) * 100;
  return Math.abs(c) >= 1 ? c : null;
}
