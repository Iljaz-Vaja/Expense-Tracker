# 💰 Expense Tracker

A fast, mobile-friendly expense tracker built with Angular 21.

**Live:** https://expense-tracker-28150.web.app

## Features

- **Income & expenses** – record money in and money out; every screen shows income, spending and net balance
- **Dashboard** – total balance, monthly income/expenses with change vs last month, savings rate, 6‑month cash‑flow chart, spending & income-source breakdowns, 30‑day spending chart, recent transactions
- **Monthly budget** – spending limit with pace marker and on-track / close / over warnings
- **Transactions** – filter by type (all / income / expenses), period, category and search; grouped by day with daily net; edit, duplicate, delete with undo
- **Reports** – income, expenses, net savings & savings rate for any period, 12‑month cash flow, category breakdown for expenses or income, weekday pattern, biggest expenses
- **Categories you choose** – show or hide any category in Settings → Categories, and add your own (name + emoji) for expenses or income
  - Expense: Food, Transport, Shopping, Bills, Entertainment, Health, Hygiene, Home, Travel, Other
  - Income: Salary, Freelance, Business, Investments, Gifts, Refunds, Rental, Other income
- **Data** – JSON backup/restore (includes custom categories), CSV export with type and signed amounts
- **Settings** – currency, budget, light/dark/auto theme
- Responsive: sidebar on desktop, bottom navigation + floating add button on mobile. Shortcuts: **N** adds an expense, **I** adds income.

## Data storage

All data stays on the user's device in `localStorage`:

| Key | Content |
| --- | --- |
| `expenses` | Array of `{ title, amount, date, category?, note?, type? }` – `type: 'income'` marks income; expenses omit it, so v1 data is unchanged |
| `expense-tracker-settings` | `{ currency, monthlyBudget, theme, hiddenCategories, customCategories }` |

> Data is tied to the site's domain. Always deploy to the same Firebase Hosting site so users keep their data.

## Development

```bash
npm install
npm start          # http://localhost:4200
npm test           # unit tests
npm run build      # production build -> dist/expense-tracer/browser
```

## Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

## Android (Capacitor)

```bash
npm run build
npx cap sync android
npx cap open android
```
