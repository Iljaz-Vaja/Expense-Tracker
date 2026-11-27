import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MoneyPipe } from './money.pipe';
import { CashflowPoint } from '../utils/stats';

/** Grouped column chart: income vs expenses per period, with a net tooltip. */
@Component({
  selector: 'app-cashflow-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  template: `
    <div class="legend" aria-hidden="true">
      <span><i class="sw in"></i>Income</span>
      <span><i class="sw out"></i>Expenses</span>
    </div>
    <div class="chart" [style.--h.px]="height()" (mouseleave)="active.set(-1)">
      <div class="grid" aria-hidden="true">
        <span class="gl"><em>{{ max() | money: true }}</em></span>
        <span class="gl"><em>{{ max() / 2 | money: true }}</em></span>
        <span class="gl base"></span>
      </div>
      <div class="cols" role="list" [attr.aria-label]="label()">
        @for (p of data(); track $index; let i = $index) {
          <div
            class="col"
            role="listitem"
            tabindex="0"
            [attr.aria-label]="p.tooltip + ': income ' + (p.income | money) + ', expenses ' + (p.expense | money)"
            [class.dim]="active() !== -1 && active() !== i"
            (mouseenter)="active.set(i)"
            (focus)="active.set(i)"
            (blur)="active.set(-1)"
          >
            <div class="pair">
              <div class="bar in" [style.height.%]="(p.income / max()) * 100"></div>
              <div class="bar out" [style.height.%]="(p.expense / max()) * 100"></div>
            </div>
            @if (active() === i) {
              <div class="tip" [class.l]="i < data().length * 0.25" [class.r]="i >= data().length * 0.75">
                <b>{{ p.tooltip }}</b>
                <span><i class="sw in"></i>Income <strong>{{ p.income | money }}</strong></span>
                <span><i class="sw out"></i>Expenses <strong>{{ p.expense | money }}</strong></span>
                <span class="net">Net <strong>{{ p.income - p.expense >= 0 ? '+' : '−' }}{{ abs(p.income - p.expense) | money }}</strong></span>
              </div>
            }
          </div>
        }
      </div>
      <div class="labels" aria-hidden="true">
        @for (p of data(); track $index; let i = $index) {
          <span>{{ i % step() === 0 || i === data().length - 1 ? p.label : '' }}</span>
        }
      </div>
    </div>
  `,
  styles: `
    .legend { display: flex; gap: 16px; font-size: 12.5px; color: var(--text-2); margin: -6px 0 6px; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }
    .sw.in { background: var(--income); } .sw.out { background: var(--expense); }
    .chart { position: relative; }
    .grid { position: absolute; inset: 18px 0 22px 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; z-index: 2; }
    .gl { border-top: 1px dashed var(--grid); position: relative; height: 0; }
    .gl.base { border-top: 1px solid var(--border); }
    .gl em { position: absolute; right: 0; top: -9px; font-style: normal; font-size: 11px; line-height: 16px; color: var(--text-3); background: var(--surface); padding: 0 4px; border-radius: 4px; }
    .cols { height: var(--h); display: flex; align-items: flex-end; gap: 4px; padding-top: 18px; }
    .col { flex: 1; height: 100%; position: relative; outline: none; border-radius: 6px; transition: opacity .15s; }
    .col.dim { opacity: .45; }
    .col:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
    .pair { height: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
    .bar { flex: 1; max-width: 18px; border-radius: 4px 4px 0 0; transition: height .4s ease; }
    .bar.in { background: var(--income); } .bar.out { background: var(--expense); }
    .tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 5; white-space: nowrap; background: var(--tooltip-bg); color: var(--tooltip-text); padding: 8px 12px; border-radius: 10px; font-size: 12px; display: flex; flex-direction: column; gap: 3px; box-shadow: var(--shadow-lg); pointer-events: none; }
    .tip.l { left: 0; transform: none; } .tip.r { left: auto; right: 0; transform: none; }
    .tip span { display: flex; align-items: center; gap: 6px; }
    .tip strong { margin-left: auto; padding-left: 12px; font-variant-numeric: tabular-nums; }
    .tip .net { border-top: 1px solid color-mix(in srgb, var(--tooltip-text) 20%, transparent); padding-top: 3px; margin-top: 1px; }
    .labels { display: flex; gap: 4px; height: 22px; align-items: flex-end; }
    .labels span { flex: 1; text-align: center; font-size: 11px; color: var(--text-3); white-space: nowrap; }
  `,
})
export class CashflowChart {
  readonly data = input.required<CashflowPoint[]>();
  readonly height = input(180);
  readonly label = input('Income vs expenses');

  protected readonly active = signal(-1);
  protected readonly max = computed(() => Math.max(1, ...this.data().flatMap((d) => [d.income, d.expense])));
  protected readonly step = computed(() => Math.max(1, Math.ceil(this.data().length / 8)));
  protected readonly abs = Math.abs;
}
