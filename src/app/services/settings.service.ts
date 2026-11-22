import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  currency: string;
  monthlyBudget: number;
  theme: ThemeMode;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  prefix: boolean;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'ALL', symbol: 'Lek', prefix: false },
  { code: 'EUR', symbol: '€', prefix: true },
  { code: 'USD', symbol: '$', prefix: true },
  { code: 'GBP', symbol: '£', prefix: true },
  { code: 'CHF', symbol: 'CHF', prefix: false },
  { code: 'MKD', symbol: 'den', prefix: false },
  { code: 'RSD', symbol: 'din', prefix: false },
  { code: 'TRY', symbol: '₺', prefix: true },
];

const DEFAULTS: Settings = { currency: 'ALL', monthlyBudget: 0, theme: 'system' };

/** User preferences – stored separately from expenses so the expense format never changes. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  static readonly storageKey = 'expense-tracker-settings';

  private readonly doc = inject(DOCUMENT);
  private readonly _settings = signal<Settings>(this.load());
  readonly settings = this._settings.asReadonly();

  private readonly numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  private readonly compactFmt = new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  constructor() {
    effect(() => {
      const theme = this._settings().theme;
      const root = this.doc.documentElement;
      if (theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', theme);
    });
  }

  update(patch: Partial<Settings>) {
    const next = { ...this._settings(), ...patch };
    this._settings.set(next);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SettingsService.storageKey, JSON.stringify(next));
    } catch {
      /* storage full / blocked – settings stay in memory */
    }
  }

  get currency(): CurrencyOption {
    return CURRENCIES.find((c) => c.code === this._settings().currency) ?? CURRENCIES[0];
  }

  format(value: number, compact = false): string {
    const c = this.currency;
    const n = (compact && Math.abs(value) >= 10000 ? this.compactFmt : this.numberFmt).format(
      value || 0,
    );
    return c.prefix ? `${c.symbol}${n}` : `${n} ${c.symbol}`;
  }

  private load(): Settings {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
      const raw = localStorage.getItem(SettingsService.storageKey);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  }
}
