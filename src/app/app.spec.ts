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
