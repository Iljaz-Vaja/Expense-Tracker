import { computed, signal } from '@angular/core';
import type { TxType } from './expense';

export interface Category {
  id: string;
  label: string;
  icon: string;
  /** CSS colour token – colour follows the category, never its rank. */
  color: string;
  type: TxType;
  /** Created by the user (can be deleted). */
  custom?: boolean;
}

/** What gets persisted for a user-created category (colour is derived). */
export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  type: TxType;
}

export const DEFAULT_CATEGORY = 'other';
export const DEFAULT_INCOME_CATEGORY = 'other-income';

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', label: 'Food & Drinks', icon: '🍔', color: 'var(--cat-1)', type: 'expense' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'var(--cat-2)', type: 'expense' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: 'var(--cat-3)', type: 'expense' },
  { id: 'bills', label: 'Bills & Utilities', icon: '💡', color: 'var(--cat-4)', type: 'expense' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: 'var(--cat-5)', type: 'expense' },
  { id: 'health', label: 'Health', icon: '💊', color: 'var(--cat-6)', type: 'expense' },
  { id: 'hygiene', label: 'Hygiene', icon: '🧼', color: 'var(--cat-9)', type: 'expense' },
  { id: 'home', label: 'Home', icon: '🏠', color: 'var(--cat-7)', type: 'expense' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: 'var(--cat-8)', type: 'expense' },
  { id: DEFAULT_CATEGORY, label: 'Other', icon: '📦', color: 'var(--cat-other)', type: 'expense' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', label: 'Salary', icon: '💼', color: 'var(--cat-3)', type: 'income' },
  { id: 'freelance', label: 'Freelance', icon: '💻', color: 'var(--cat-1)', type: 'income' },
  { id: 'business', label: 'Business', icon: '🏪', color: 'var(--cat-7)', type: 'income' },
  { id: 'investments', label: 'Investments', icon: '📈', color: 'var(--cat-9)', type: 'income' },
  { id: 'gifts', label: 'Gifts', icon: '🎁', color: 'var(--cat-5)', type: 'income' },
  { id: 'refunds', label: 'Refunds', icon: '↩️', color: 'var(--cat-4)', type: 'income' },
  { id: 'rental', label: 'Rental', icon: '🏘️', color: 'var(--cat-2)', type: 'income' },
  { id: DEFAULT_INCOME_CATEGORY, label: 'Other income', icon: '💰', color: 'var(--cat-other)', type: 'income' },
];

/** @deprecated kept for older imports – expense categories only. */
export const CATEGORIES = EXPENSE_CATEGORIES;

const PALETTE = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `var(--cat-${n})`);

/** User-created categories. A signal so anything computed from categories reacts to edits. */
const custom = signal<Category[]>([]);

export function setCustomCategories(list: CustomCategory[] | undefined) {
  custom.set(
    (list ?? []).map((c, i) => ({ ...c, color: PALETTE[(i + 4) % PALETTE.length], custom: true })),
  );
}

export const defaultCategoryOf = (type: TxType) =>
  type === 'income' ? DEFAULT_INCOME_CATEGORY : DEFAULT_CATEGORY;

/** Built-ins of that type, then custom ones, with the catch-all "Other" always last. */
export function categoriesOf(type: TxType): Category[] {
  const builtIn = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const fallback = defaultCategoryOf(type);
  return [
    ...builtIn.filter((c) => c.id !== fallback),
    ...custom().filter((c) => c.type === type),
    ...builtIn.filter((c) => c.id === fallback),
  ];
}

const byId = computed(
  () => new Map([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...custom()].map((c) => [c.id, c])),
);

export function getCategory(id?: string | null, type: TxType = 'expense'): Category {
  return (id && byId().get(id)) || byId().get(defaultCategoryOf(type))!;
}
