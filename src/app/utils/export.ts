import { Expense, isIncome, signedAmount, txType } from '../models/expense';
import { CustomCategory, getCategory } from '../models/category';
import { sanitizeCustom } from '../services/settings.service';

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(expenses: Expense[]): string {
  const rows = [['Date', 'Time', 'Type', 'Title', 'Category', 'Amount', 'Note']];
  for (const e of expenses) {
    const d = new Date(e.date);
    const valid = !isNaN(d.getTime());
    rows.push([
      valid ? d.toLocaleDateString() : e.date,
      valid ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      isIncome(e) ? 'Income' : 'Expense',
      e.title,
      getCategory(e.category, txType(e)).label,
      String(signedAmount(e)),
      e.note ?? '',
    ]);
  }
  // BOM so Excel opens UTF-8 (ë, ç, €) correctly
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export interface Backup {
  expenses: Expense[];
  customCategories: CustomCategory[];
}

/** Accepts a v2/v3 backup object or a plain v1-style array. Returns null if unusable. */
export function parseBackup(text: string): Backup | null {
  try {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : Array.isArray(data?.expenses) ? data.expenses : null;
    if (!list) return null;
    return {
      expenses: list.filter(
        (e: any) =>
          e && typeof e.title === 'string' && !isNaN(Number(e.amount)) && typeof e.date === 'string',
      ),
      customCategories: sanitizeCustom(data?.settings?.customCategories),
    };
  } catch {
    return null;
  }
}

export const stamp = () => new Date().toISOString().slice(0, 10);
