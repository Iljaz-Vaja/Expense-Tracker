import { Category, getCategory } from '../models/category';
import { ExpenseEntry } from '../models/expense';
import { Range, addDays, addMonths, dayKey, inRange, monthKey, startOfDay } from './date';

export interface CategoryStat {
  category: Category;
  total: number;
  count: number;
  pct: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
  tooltip: string;
}

export const sum = (entries: ExpenseEntry[]) =>
  entries.reduce((s, e) => s + (Number(e.expense.amount) || 0), 0);

export const filterRange = (entries: ExpenseEntry[], r: Range) =>
  entries.filter((e) => inRange(e.time, r));

export function byCategory(entries: ExpenseEntry[]): CategoryStat[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const id = getCategory(e.expense.category).id;
    const cur = map.get(id) ?? { total: 0, count: 0 };
    cur.total += Number(e.expense.amount) || 0;
    cur.count++;
    map.set(id, cur);
  }
  const total = [...map.values()].reduce((s, v) => s + v.total, 0) || 1;
  return [...map.entries()]
    .map(([id, v]) => ({ category: getCategory(id), ...v, pct: (v.total / total) * 100 }))
    .sort((a, b) => b.total - a.total);
}

/** Keep the top N categories, fold the rest into "Other". */
export function foldCategories(stats: CategoryStat[], keep = 5): CategoryStat[] {
  if (stats.length <= keep + 1) return stats;
  const head = stats.filter((s) => s.category.id !== 'other').slice(0, keep);
  const rest = stats.filter((s) => !head.includes(s));
  const other = rest.reduce(
    (acc, s) => ({ ...acc, total: acc.total + s.total, count: acc.count + s.count, pct: acc.pct + s.pct }),
    { category: getCategory('other'), total: 0, count: 0, pct: 0 } as CategoryStat,
  );
  return [...head, other];
}

export function dailySeries(entries: ExpenseEntry[], end: Date, days: number): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const k = dayKey(e.time);
    totals.set(k, (totals.get(k) ?? 0) + (Number(e.expense.amount) || 0));
  }
  const first = addDays(startOfDay(end), -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(first, i);
    return {
      label: String(d.getDate()),
      value: totals.get(dayKey(d)) ?? 0,
      tooltip: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  });
}

export function monthlySeries(entries: ExpenseEntry[], end: Date, months: number): SeriesPoint[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const k = monthKey(e.time);
    totals.set(k, (totals.get(k) ?? 0) + (Number(e.expense.amount) || 0));
  }
  return Array.from({ length: months }, (_, i) => {
    const d = addMonths(end, i - (months - 1));
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      value: totals.get(monthKey(d)) ?? 0,
      tooltip: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  });
}

export function weekdaySeries(entries: ExpenseEntry[]): SeriesPoint[] {
  const totals = Array(7).fill(0);
  for (const e of entries) totals[(e.time.getDay() + 6) % 7] += Number(e.expense.amount) || 0;
  const monday = new Date(2024, 0, 1); // a Monday
  return totals.map((value, i) => {
    const d = addDays(monday, i);
    return {
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      value,
      tooltip: d.toLocaleDateString(undefined, { weekday: 'long' }),
    };
  });
}
