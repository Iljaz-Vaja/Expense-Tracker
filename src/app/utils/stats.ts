import { Category, getCategory } from '../models/category';
import { ExpenseEntry, TxType, signedAmount, txType } from '../models/expense';
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

export interface CashflowPoint {
  label: string;
  tooltip: string;
  income: number;
  expense: number;
}

export const sum = (entries: ExpenseEntry[]) =>
  entries.reduce((s, e) => s + (Number(e.expense.amount) || 0), 0);

/** Income minus expenses. */
export const net = (entries: ExpenseEntry[]) => entries.reduce((s, e) => s + signedAmount(e.expense), 0);

export const ofType = (entries: ExpenseEntry[], type: TxType) =>
  entries.filter((e) => txType(e.expense) === type);
export const spending = (entries: ExpenseEntry[]) => ofType(entries, 'expense');
export const incomes = (entries: ExpenseEntry[]) => ofType(entries, 'income');

export const filterRange = (entries: ExpenseEntry[], r: Range) =>
  entries.filter((e) => inRange(e.time, r));

/** Share of income that was kept, or null when there was no income. */
export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? ((income - expense) / income) * 100 : null;
}

export function byCategory(entries: ExpenseEntry[]): CategoryStat[] {
  const map = new Map<string, { total: number; count: number; category: Category }>();
  for (const e of entries) {
    const category = getCategory(e.expense.category, txType(e.expense));
    const cur = map.get(category.id) ?? { total: 0, count: 0, category };
    cur.total += Number(e.expense.amount) || 0;
    cur.count++;
    map.set(category.id, cur);
  }
  const total = [...map.values()].reduce((s, v) => s + v.total, 0) || 1;
  return [...map.values()]
    .map((v) => ({ ...v, pct: (v.total / total) * 100 }))
    .sort((a, b) => b.total - a.total);
}

/** Keep the top N categories, fold the rest into the catch-all "Other". */
export function foldCategories(stats: CategoryStat[], keep = 5): CategoryStat[] {
  if (stats.length <= keep + 1) return stats;
  const fallback = getCategory(null, stats[0].category.type);
  const head = stats.filter((s) => s.category.id !== fallback.id).slice(0, keep);
  const rest = stats.filter((s) => !head.includes(s));
  const other = rest.reduce(
    (acc, s) => ({ ...acc, total: acc.total + s.total, count: acc.count + s.count, pct: acc.pct + s.pct }),
    { category: fallback, total: 0, count: 0, pct: 0 } as CategoryStat,
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

/** Income and expenses per month, ending with the month of `end`. */
export function cashflowSeries(entries: ExpenseEntry[], end: Date, months: number): CashflowPoint[] {
  const totals = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const k = monthKey(e.time);
    const cur = totals.get(k) ?? { income: 0, expense: 0 };
    cur[txType(e.expense)] += Number(e.expense.amount) || 0;
    totals.set(k, cur);
  }
  return Array.from({ length: months }, (_, i) => {
    const d = addMonths(end, i - (months - 1));
    const t = totals.get(monthKey(d)) ?? { income: 0, expense: 0 };
    return {
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      tooltip: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      ...t,
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
