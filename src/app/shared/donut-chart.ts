import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MoneyPipe } from './money.pipe';
import { CategoryStat } from '../utils/stats';

const R = 40;
const C = 2 * Math.PI * R;
const GAP = 1.2;

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyPipe],
  template: `
    <div class="donut-wrap">
      <div class="donut">
        <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="label()">
          <circle cx="50" cy="50" [attr.r]="r" fill="none" stroke="var(--surface-2)" stroke-width="12" />
          @for (s of segments(); track s.stat.category.id; let i = $index) {
            <circle
              cx="50"
              cy="50"
              [attr.r]="r"
              fill="none"
              [attr.stroke]="s.stat.category.color"
              [attr.stroke-width]="active() === i ? 15 : 12"
              [attr.stroke-dasharray]="s.dash"
              [attr.stroke-dashoffset]="s.offset"
              [class.dim]="active() !== -1 && active() !== i"
              transform="rotate(-90 50 50)"
              (mouseenter)="active.set(i)"
              (mouseleave)="active.set(-1)"
            />
          }
        </svg>
        <div class="center">
          @if (current(); as c) {
            <span class="c-label">{{ c.category.icon }} {{ c.category.label }}</span>
            <strong>{{ c.total | money: true }}</strong>
            <span class="c-label">{{ c.pct.toFixed(0) }}%</span>
          } @else {
            <span class="c-label">Total</span>
            <strong>{{ total() | money: true }}</strong>
          }
        </div>
      </div>
      <ul class="legend">
        @for (s of data(); track s.category.id; let i = $index) {
          <li
            [class.dim]="active() !== -1 && active() !== i"
            (mouseenter)="active.set(i)"
            (mouseleave)="active.set(-1)"
          >
            <span class="sw" [style.background]="s.category.color"></span>
            <span class="lbl">{{ s.category.icon }} {{ s.category.label }}</span>
            <span class="val">{{ s.total | money }}</span>
            <span class="pct">{{ s.pct.toFixed(0) }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .donut-wrap { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
    .donut { position: relative; width: 180px; height: 180px; flex-shrink: 0; margin: 0 auto; }
    svg { width: 100%; height: 100%; overflow: visible; }
    circle { transition: stroke-width .15s, opacity .15s; }
    circle.dim, li.dim { opacity: .4; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; padding: 34px; }
    .center strong { font-size: 20px; letter-spacing: -.02em; }
    .c-label { font-size: 12px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 4px; }
    li { display: grid; grid-template-columns: 10px 1fr auto 40px; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 8px; font-size: 14px; transition: opacity .15s, background .15s; }
    li:hover { background: var(--surface-2); }
    .sw { width: 10px; height: 10px; border-radius: 3px; }
    .lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .val { font-weight: 600; font-variant-numeric: tabular-nums; }
    .pct { color: var(--text-3); text-align: right; font-size: 13px; }
  `,
})
export class DonutChart {
  readonly data = input.required<CategoryStat[]>();
  readonly label = input('Breakdown by category');
  protected readonly r = R;
  protected readonly active = signal(-1);

  protected readonly total = computed(() => this.data().reduce((s, d) => s + d.total, 0));
  protected readonly current = computed(() => this.data()[this.active()] ?? null);

  protected readonly segments = computed(() => {
    const total = this.total() || 1;
    const gap = this.data().length > 1 ? GAP : 0;
    let acc = 0;
    return this.data().map((stat) => {
      const len = (stat.total / total) * C;
      const seg = {
        stat,
        dash: `${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`,
        offset: -acc,
      };
      acc += len;
      return seg;
    });
  });
}
