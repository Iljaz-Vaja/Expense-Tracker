# 💰 Expense Tracker

A fast, mobile-friendly expense tracker built with Angular 21.

**Live:** https://expense-tracker-28150.web.app

## Features

- **Dashboard** – monthly spend vs last month, today/week totals, daily average & projection, 30-day chart, category breakdown, recent transactions
- **Monthly budget** – progress bar with pace marker and on-track / close / over warnings
- **Transactions** – search, filter by period & category, sort, grouped by day with daily totals, edit, duplicate, delete with undo
- **Reports** – custom date ranges, category breakdown, 12-month trend, weekday pattern, biggest expenses
- **Categories** – Food, Transport, Shopping, Bills, Entertainment, Health, Hygiene, Home, Travel, Other
- **Data** – JSON backup/restore, CSV export (Excel-friendly)
- **Settings** – currency, budget, light/dark/auto theme
- Responsive: sidebar on desktop, bottom navigation + floating add button on mobile. Press **N** to add an expense on desktop.

## Data storage

All data stays on the user's device in `localStorage`:

| Key | Content |
| --- | --- |
| `expenses` | Array of `{ title, amount, date, category?, note? }` – compatible with v1 data |
| `expense-tracker-settings` | `{ currency, monthlyBudget, theme }` |

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
