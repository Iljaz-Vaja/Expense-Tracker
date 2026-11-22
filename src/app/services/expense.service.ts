import { Injectable, computed, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Expense, ExpenseEntry } from '../models/expense';

/**
 * Persistence layer for expenses.
 *
 * Storage contract (unchanged from v1 so existing users keep their data):
 *   localStorage['expenses'] = JSON array of { title, amount, date, ...optional fields }
 */
@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  private readonly storageKey = 'expenses';

  private expensesSubject = new BehaviorSubject<Expense[]>([]);
  expenses$ = this.expensesSubject.asObservable();

  /** Signal mirror of the stored list (for templates / computed values). */
  private readonly _expenses = signal<Expense[]>([]);
  readonly expenses = this._expenses.asReadonly();

  /** Every expense with its storage index and parsed date (invalid dates skipped). */
  readonly entries = computed<ExpenseEntry[]>(() =>
    this._expenses()
      .map((expense, index) => ({ expense, index, time: new Date(expense.date) }))
      .filter((e) => !isNaN(e.time.getTime())),
  );

  constructor() {
    this.loadInitialData();

    // Keep multiple open tabs in sync.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === this.storageKey) this.loadInitialData();
      });
    }
  }

  // ✅ SAFE INIT (no SSR crash)
  private loadInitialData() {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        this.emit([]);
        return;
      }

      const parsed = JSON.parse(data);
      this.emit(Array.isArray(parsed) ? parsed.map(normalize) : []);
    } catch (e) {
      console.error('Invalid storage data, resetting...');
      localStorage.removeItem(this.storageKey);
    }
  }

  getExpenses(): Expense[] {
    return this.expensesSubject.value;
  }

  addExpense(expense: Expense) {
    const current = this.expensesSubject.value;

    const updated = [
      ...current,
      {
        ...expense,
        date: expense.date || new Date().toISOString(),
      },
    ];

    this.commit(updated);
  }

  updateExpense(index: number, expense: Expense) {
    const updated = this.expensesSubject.value.map((e, i) => (i === index ? { ...expense } : e));
    this.commit(updated);
  }

  deleteExpense(index: number) {
    const updated = this.expensesSubject.value.filter((_, i) => i !== index);
    this.commit(updated);
  }

  /** Put a deleted expense back where it was (undo). */
  restoreExpense(expense: Expense, index: number) {
    const updated = [...this.expensesSubject.value];
    updated.splice(Math.min(index, updated.length), 0, expense);
    this.commit(updated);
  }

  /** Replace the full list (used by import / clear all). */
  replaceAll(expenses: Expense[]) {
    this.commit(expenses.map(normalize));
  }

  private commit(updated: Expense[]) {
    this.emit(updated);
    this.save(updated);
  }

  private emit(list: Expense[]) {
    this.expensesSubject.next(list);
    this._expenses.set(list);
  }

  private save(data: Expense[]) {
    if (typeof window === 'undefined') return;

    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }
}

/** Read-side safety: older/imported records may have string amounts. Never drops fields. */
function normalize(e: any): Expense {
  return {
    ...e,
    title: String(e?.title ?? ''),
    amount: Number(e?.amount) || 0,
    date: String(e?.date ?? ''),
  };
}
