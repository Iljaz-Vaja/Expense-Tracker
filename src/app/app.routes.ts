import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · Expense Tracker',
    loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage),
  },
  {
    path: 'transactions',
    title: 'Transactions · Expense Tracker',
    loadComponent: () => import('./pages/transactions').then((m) => m.TransactionsPage),
  },
  {
    path: 'reports',
    title: 'Reports · Expense Tracker',
    loadComponent: () => import('./pages/reports').then((m) => m.ReportsPage),
  },
  {
    path: 'settings',
    title: 'Settings · Expense Tracker',
    loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage),
  },
  { path: '**', redirectTo: '' },
];
