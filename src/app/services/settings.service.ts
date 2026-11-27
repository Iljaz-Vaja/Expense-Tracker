import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';
import {
  Category,
  CustomCategory,
  categoriesOf,
  defaultCategoryOf,
  setCustomCategories,
} from '../models/category';
import { TxType } from '../models/expense';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  currency: string;
  monthlyBudget: number;
  theme: ThemeMode;
  /** Category ids the user chose not to show when adding transactions. */
  hiddenCategories: string[];
  customCategories: CustomCategory[];
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

const DEFAULTS: Settings = {
  currency: 'ALL',
  monthlyBudget: 0,
  theme: 'system',
  hiddenCategories: [],
  customCategories: [],
};

/** User preferences – stored separately from transactions so the stored format never changes. */
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
    setCustomCategories(this._settings().customCategories);
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
    if (patch.customCategories) setCustomCategories(next.customCategories);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SettingsService.storageKey, JSON.stringify(next));
    } catch {
      /* storage full / blocked – settings stay in memory */
    }
  }

  /** Categories offered when adding a transaction. The catch-all "Other" can never be hidden. */
  visibleCategories(type: TxType): Category[] {
    const hidden = new Set(this._settings().hiddenCategories);
    const fallback = defaultCategoryOf(type);
    return categoriesOf(type).filter((c) => c.id === fallback || !hidden.has(c.id));
  }

  /** Every category of a type, visible or hidden (for the settings screen). */
  categoriesFor(type: TxType): Category[] {
    return categoriesOf(type);
  }

  isHidden(id: string): boolean {
    return this._settings().hiddenCategories.includes(id);
  }

  setHidden(id: string, hidden: boolean) {
    const set = new Set(this._settings().hiddenCategories);
    if (hidden) set.add(id);
    else set.delete(id);
    this.update({ hiddenCategories: [...set] });
  }

  addCustomCategory(label: string, icon: string, type: TxType): CustomCategory {
    const cat: CustomCategory = {
      id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      label,
      icon,
      type,
    };
    this.update({ customCategories: [...this._settings().customCategories, cat] });
    return cat;
  }

  removeCustomCategory(id: string) {
    const s = this._settings();
    this.update({
      customCategories: s.customCategories.filter((c) => c.id !== id),
      hiddenCategories: s.hiddenCategories.filter((h) => h !== id),
    });
  }

  /** Add custom categories from a backup that don't exist yet (by id). */
  mergeCustomCategories(list: CustomCategory[]) {
    const current = this._settings().customCategories;
    const ids = new Set(current.map((c) => c.id));
    const add = list.filter((c) => !ids.has(c.id));
    if (add.length) this.update({ customCategories: [...current, ...add] });
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
      const s = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
      s.hiddenCategories = Array.isArray(s.hiddenCategories) ? s.hiddenCategories : [];
      s.customCategories = sanitizeCustom(s.customCategories);
      return s;
    } catch {
      return DEFAULTS;
    }
  }
}

export function sanitizeCustom(list: unknown): CustomCategory[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
    .map((c: any) => ({
      id: c.id,
      label: c.label,
      icon: typeof c.icon === 'string' && c.icon ? c.icon : '🏷️',
      type: c.type === 'income' ? 'income' : 'expense',
    }));
}
