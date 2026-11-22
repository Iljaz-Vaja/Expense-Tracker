import { Injectable, inject, signal } from '@angular/core';
import { Expense } from '../models/expense';
import { ExpenseService } from './expense.service';
import { toLocalInput } from '../utils/date';

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

export interface FormState {
  /** Storage index when editing; null when adding. */
  index: number | null;
  initial: Partial<Expense>;
}

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly expenses = inject(ExpenseService);

  readonly form = signal<FormState | null>(null);
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  openAdd(prefill: Partial<Expense> = {}) {
    this.form.set({ index: null, initial: prefill });
  }

  openEdit(index: number, expense: Expense) {
    this.form.set({ index, initial: { ...expense } });
  }

  /** Open the add form pre-filled with an existing expense, dated now. */
  duplicate(expense: Expense) {
    this.openAdd({ ...expense, date: toLocalInput(new Date()) });
  }

  closeForm() {
    this.form.set(null);
  }

  deleteWithUndo(index: number) {
    const expense = this.expenses.getExpenses()[index];
    if (!expense) return;
    this.expenses.deleteExpense(index);
    this.toast(`Deleted “${expense.title}”`, {
      action: { label: 'Undo', run: () => this.expenses.restoreExpense(expense, index) },
    });
  }

  toast(message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
    const t: Toast = { id: this.nextId++, message, tone: opts.tone ?? 'default', action: opts.action };
    this.toasts.update((list) => [...list.slice(-2), t]);
    setTimeout(() => this.dismiss(t.id), t.action ? 6000 : 3500);
  }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
