import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MoneyPipe } from './money.pipe';
import { SeriesPoint } from '../utils/stats';

/** Single-series column chart with hover/focus tooltips. HTML-based so it is fully responsive. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  template: `
    <div class="chart" [style.--h.px]="height()" (mouseleave)="active.set(-1)">
      <div class="grid" aria-hidden="true">
        <span class="gl"><em>{{ max() | money: true }}</em></span>
        <span class="gl"><em>{{ max() / 2 | money: true }}</em></span>
        <span class="gl base"></span>
      </div>
      <div class="bars" role="list" [attr.aria-label]="label()">
        @for (p of data(); track $index; let i = $index) {
          <div
            class="col"
            role="listitem"
            tabindex="0"
            [attr.aria-label]="p.tooltip + ': ' + (p.value | money)"
            (mouseenter)="active.set(i)"
            (focus)="active.set(i)"
            (blur)="active.set(-1)"
          >
            <div
              class="bar"
              [class.on]="active() === i"
              [class.dim]="active() !== -1 && active() !== i"
              [class.mark]="highlightLast() && i === data().length - 1"
              [style.height.%]="(p.value / max()) * 100"
            ></div>
            @if (active() === i) {
              <div class="tip" [class.l]="i < data().length * 0.2" [class.r]="i > data().length * 0.8">
                <strong>{{ p.value | money }}</strong>
                <span>{{ p.tooltip }}</span>
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
    .chart { position: relative; padding-left: 0; }
    .grid { position: absolute; inset: 18px 0 22px 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; z-index: 2; }
    .gl { border-top: 1px dashed var(--grid); position: relative; height: 0; }
    .gl.base { border-top: 1px solid var(--border); }
    .gl em { position: absolute; right: 0; top: -9px; font-style: normal; font-size: 11px; line-height: 16px; color: var(--text-3); background: var(--surface); padding: 0 4px; border-radius: 4px; }
    .bars { height: var(--h); display: flex; align-items: flex-end; gap: 2px; padding-top: 18px; }
    .col { flex: 1; height: 100%; display: flex; align-items: flex-end; position: relative; cursor: default; outline: none; border-radius: 4px; }
    .col:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
    .bar { width: 100%; max-width: 36px; margin: 0 auto; background: var(--chart-bar); border-radius: 4px 4px 0 0; transition: opacity .15s, background .15s; min-height: 0; }
    .bar.mark { background: var(--accent); }
    .bar.on { background: var(--accent); }
    .bar.dim { opacity: .45; }
    .tip { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 5; white-space: nowrap; background: var(--tooltip-bg); color: var(--tooltip-text); padding: 6px 10px; border-radius: 8px; font-size: 12px; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); pointer-events: none; }
    .tip.l { left: 0; transform: none; }
    .tip.r { left: auto; right: 0; transform: none; }
    .tip span { opacity: .75; }
    .labels { display: flex; gap: 2px; height: 22px; align-items: flex-end; }
    .labels span { flex: 1; text-align: center; font-size: 11px; color: var(--text-3); overflow: visible; white-space: nowrap; }
  `,
})
export class BarChart {
  readonly data = input.required<SeriesPoint[]>();
  readonly height = input(160);
  readonly label = input('Chart');
  readonly highlightLast = input(false);

  protected readonly active = signal(-1);
  protected readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
  protected readonly step = computed(() => Math.max(1, Math.ceil(this.data().length / 8)));
}
