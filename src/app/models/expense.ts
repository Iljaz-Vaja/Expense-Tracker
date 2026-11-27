export type TxType = 'expense' | 'income';

/**
 * Shape of a transaction as stored in localStorage under the `expenses` key.
 *
 * IMPORTANT: `title`, `amount` and `date` are the original fields and must stay
 * exactly as they are so data saved by earlier versions keeps working.
 * New fields are OPTIONAL – old records simply don't have them.
 */
export interface Expense {
  title: string;
  /** Always a positive number – the direction comes from `type`. */
  amount: number;
  date: string;
  /** Category id (see category.ts). Missing on older records → treated as "other". */
  category?: string;
  /** Optional free-text note. */
  note?: string;
  /** Missing on older records (and on all expenses) → 'expense'. Only income stores `type: 'income'`. */
  type?: TxType;
}

/** A transaction together with its position in the stored array (used for edit/delete). */
export interface ExpenseEntry {
  expense: Expense;
  index: number;
  time: Date;
}

export const txType = (e: Pick<Expense, 'type'>): TxType => (e.type === 'income' ? 'income' : 'expense');
export const isIncome = (e: Pick<Expense, 'type'>) => txType(e) === 'income';

/** Positive for income, negative for expenses. */
export const signedAmount = (e: Expense) => (isIncome(e) ? 1 : -1) * (Number(e.amount) || 0);
