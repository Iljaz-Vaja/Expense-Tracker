import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Toast, UiService } from '../services/ui.service';
import { Icon } from './icon';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="stack" aria-live="polite">
      @for (t of ui.toasts(); track t.id) {
        <div class="toast" [class]="t.tone">
          @if (t.tone === 'success') { <app-icon name="check" [size]="18" /> }
          @if (t.tone === 'error') { <app-icon name="alert" [size]="18" /> }
          <span class="msg">{{ t.message }}</span>
          @if (t.action) {
            <button type="button" class="act" (click)="run(t)">{{ t.action.label }}</button>
          }
          <button type="button" class="x" (click)="ui.dismiss(t.id)" aria-label="Dismiss">
            <app-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack { position: fixed; z-index: 200; left: 50%; transform: translateX(-50%); bottom: calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100vw - 32px)); pointer-events: none; }
    @media (max-width: 959px) { .stack { bottom: calc(92px + env(safe-area-inset-bottom)); } }
    .toast { pointer-events: auto; display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 16px; border-radius: 14px; background: var(--tooltip-bg); color: var(--tooltip-text); box-shadow: var(--shadow-lg); font-size: 14px; animation: in .2s ease-out; }
    .toast.success app-icon { color: var(--good-on-dark); }
    .toast.error app-icon { color: var(--critical-on-dark); }
    .msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .act { background: none; border: 0; color: var(--accent-on-dark); font: inherit; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
    .act:hover { background: rgba(255,255,255,.1); }
    .x { background: none; border: 0; color: inherit; opacity: .6; cursor: pointer; padding: 4px; display: grid; border-radius: 8px; }
    .x:hover { opacity: 1; }
    @keyframes in { from { opacity: 0; transform: translateY(8px); } }
  `,
})
export class Toasts {
  protected readonly ui = inject(UiService);

  protected run(t: Toast) {
    t.action?.run();
    this.ui.dismiss(t.id);
  }
}
