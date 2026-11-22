const pad = (n: number) => String(n).padStart(2, '0');

/** Format for <input type="datetime-local"> – same format v1 stored. */
export function toLocalInput(d: Date): string {
  return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format for <input type="date"> (local, not UTC). */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar-day key, e.g. 2026-11-22. */
export const dayKey = toDateInput;

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Parse a YYYY-MM-DD string as a LOCAL date (new Date('YYYY-MM-DD') would be UTC). */
export function parseDateInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** Monday-based week start. */
export function startOfWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -day);
}

export type Period =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'lastMonth'
  | 'last3Months'
  | 'year'
  | 'custom';

export const PERIOD_LABELS: Record<Period, string> = {
  all: 'All time',
  today: 'Today',
  week: 'This week',
  month: 'This month',
  lastMonth: 'Last month',
  last3Months: 'Last 3 months',
  year: 'This year',
  custom: 'Custom range',
};

export interface Range {
  start: Date | null;
  end: Date | null;
}

export function periodRange(p: Period, customStart = '', customEnd = '', now = new Date()): Range {
  switch (p) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now), end: endOfDay(addDays(startOfWeek(now), 6)) };
    case 'month':
      return { start: startOfMonth(now), end: new Date(addMonths(now, 1).getTime() - 1) };
    case 'lastMonth':
      return { start: addMonths(now, -1), end: new Date(startOfMonth(now).getTime() - 1) };
    case 'last3Months':
      return { start: addMonths(now, -2), end: endOfDay(now) };
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    case 'custom': {
      const s = parseDateInput(customStart);
      const e = parseDateInput(customEnd);
      return { start: s, end: e ? endOfDay(e) : null };
    }
    default:
      return { start: null, end: null };
  }
}

export function inRange(t: Date, r: Range): boolean {
  return (!r.start || t >= r.start) && (!r.end || t <= r.end);
}
