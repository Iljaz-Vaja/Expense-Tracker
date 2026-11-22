export interface Category {
  id: string;
  label: string;
  icon: string;
  /** CSS colour token – colour follows the category, never its rank. */
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'food', label: 'Food & Drinks', icon: '🍔', color: 'var(--cat-1)' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: 'var(--cat-2)' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: 'var(--cat-3)' },
  { id: 'bills', label: 'Bills & Utilities', icon: '💡', color: 'var(--cat-4)' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: 'var(--cat-5)' },
  { id: 'health', label: 'Health', icon: '💊', color: 'var(--cat-6)' },
  { id: 'hygiene', label: 'Hygiene', icon: '🧼', color: 'var(--cat-9)' },
  { id: 'home', label: 'Home', icon: '🏠', color: 'var(--cat-7)' },
  { id: 'travel', label: 'Travel', icon: '✈️', color: 'var(--cat-8)' },
  { id: 'other', label: 'Other', icon: '📦', color: 'var(--cat-other)' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const DEFAULT_CATEGORY = 'other';

export function getCategory(id?: string | null): Category {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_CATEGORY)!;
}
