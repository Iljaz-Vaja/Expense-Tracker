/**
 * Shape of an expense as stored in localStorage under the `expenses` key.
 *
 * IMPORTANT: `title`, `amount` and `date` are the original fields and must stay
 * exactly as they are so data saved by earlier versions keeps working.
 * New fields are OPTIONAL – old records simply don't have them.
 */
export interface Expense {
  title: string;
  amount: number;
  date: string;
  /** Category id (see categories.ts). Missing on older records → treated as "other". */
  category?: string;
  /** Optional free-text note. */
  note?: string;
}

/** An expense together with its position in the stored array (used for edit/delete). */
export interface ExpenseEntry {
  expense: Expense;
  index: number;
  time: Date;
}
