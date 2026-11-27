import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { ExpenseService } from './services/expense.service';

// Node 26 exposes an unconfigured global localStorage that shadows jsdom's – use an in-memory one.
const mem = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  },
});

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand')?.textContent).toContain('Expense');
  });
});

describe('ExpenseService storage compatibility', () => {
  it('reads v1 data from the "expenses" key and keeps the same format when saving', () => {
    const v1 = [{ title: 'Coffee', amount: 150, date: '2026-01-05T08:30' }];
    localStorage.clear();
    localStorage.setItem('expenses', JSON.stringify(v1));
    TestBed.resetTestingModule();
    const svc = TestBed.inject(ExpenseService);

    expect(svc.getExpenses()).toEqual(v1);

    svc.addExpense({ title: 'Bus', amount: 40, date: '2026-01-05T09:00', category: 'transport' });
    const saved = JSON.parse(localStorage.getItem('expenses')!);
    expect(saved.length).toBe(2);
    expect(saved[0]).toEqual(v1[0]);
    expect(saved[1].title).toBe('Bus');
  });
});

describe('Income support', () => {
  it('stores income with type and keeps expenses in the v1 shape', async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    const svc = TestBed.inject(ExpenseService);
    svc.addExpense({ title: 'Salary', amount: 1000, date: '2026-01-01T09:00', category: 'salary', type: 'income' });
    svc.addExpense({ title: 'Lunch', amount: 30, date: '2026-01-01T12:00', category: 'food' });
    const saved = JSON.parse(localStorage.getItem('expenses')!);
    expect(saved[0].type).toBe('income');
    expect('type' in saved[1]).toBe(false);

    const { net, incomes, spending, sum, savingsRate } = await import('./utils/stats');
    const entries = svc.entries();
    expect(sum(incomes(entries))).toBe(1000);
    expect(sum(spending(entries))).toBe(30);
    expect(net(entries)).toBe(970);
    expect(savingsRate(1000, 30)).toBe(97);
    expect(savingsRate(0, 30)).toBeNull();
  });
});

describe('Category visibility', () => {
  it('hides chosen categories but never the catch-all', async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    const { SettingsService } = await import('./services/settings.service');
    const settings = TestBed.inject(SettingsService);
    settings.setHidden('food', true);
    settings.setHidden('other', true);
    const ids = settings.visibleCategories('expense').map((c) => c.id);
    expect(ids).not.toContain('food');
    expect(ids).toContain('other');

    const custom = settings.addCustomCategory('Pets', '🐶', 'expense');
    expect(settings.visibleCategories('expense').map((c) => c.id)).toContain(custom.id);
    expect(settings.visibleCategories('income').map((c) => c.id)).not.toContain(custom.id);
    const { getCategory } = await import('./models/category');
    expect(getCategory(custom.id).label).toBe('Pets');
    settings.removeCustomCategory(custom.id);
    expect(getCategory(custom.id).id).toBe('other');
    expect(getCategory('missing', 'income').id).toBe('other-income');
  });
});
