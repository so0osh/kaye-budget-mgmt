# CLAUDE.md

## Project Overview

**kaye-budget-mgmt** is an advertising budget management web app (ניהול תקציב פרסום).

- **Frontend**: Vanilla JS / HTML / CSS (`static/`)
- **Data store**: Google Sheets via the Google Sheets API v4 (direct from browser)
- **Auth**: Google OAuth2 (Google Identity Services, single-user)
- **Hosting**: GitHub Pages (serves `static/` from `main` branch)
- **Current version**: set in `static/config.js` → `APP_VERSION`

---

## Architecture

```
static/
  index.html       — SPA shell; loads GIS, config.js, sheets-api.js, app.js
  style.css        — Styles (RTL Hebrew)
  app.js           — All UI logic; calls sheets-api.js for data operations
  sheets-api.js    — Google Sheets API v4 REST wrapper + GIS auth + seedSheets
  config.js        — SPREADSHEET_ID, OAUTH_CLIENT_ID, APP_VERSION (committed)
docs/
  superpowers/
    specs/         — Design documents
    plans/         — Implementation plans
```

Google Sheets tabs (Hebrew names):

| Key           | Tab name   | Purpose                                      |
|---------------|------------|----------------------------------------------|
| `budget`      | תקציב      | Fiscal years + opening budgets               |
| `transactions`| תנועות     | Individual spend transactions                |
| `suppliers`   | ספקים      | Supplier list (with optional dept assignment)|
| `statuses`    | סטטוסים    | Transaction status definitions               |
| `reserves`    | שמורות     | Budget reserves / earmarks                   |
| `departments` | מחלקות     | Department list                              |

---

## sheets-api.js

Exported functions (called by `app.js`):

| Function | Description |
|---|---|
| `initAuth()` | Initialise GIS token client — called on DOMContentLoaded |
| `signIn()` | Request OAuth2 token (user-initiated, shows Google popup first time) |
| `signOut()` | Revoke token and clear sessionStorage |
| `getToken()` | Return valid access token (auto-refreshes silently if expired) |
| `readAllSheets()` | Batch-read all 6 tabs, return `{ budget, transactions, ... }` |
| `appendRow(sheetKey, values)` | Append a row to the named sheet |
| `updateRowById(sheetKey, rowId, values)` | Find row by column A value and overwrite |
| `deleteRowById(sheetKey, rowId)` | Find row by column A value and delete |
| `seedSheets()` | Create missing tabs; write headers + seed data to empty tabs only |

---

## Deployment

**Production URL:** `https://so0osh.github.io/kaye-budget-mgmt`

**Deploy:** `git push origin main` — GitHub Pages auto-deploys within ~60 seconds.

**One-time setup** (already done):
1. Google Cloud Console — OAuth2 Web client, authorized origin: `https://so0osh.github.io`
2. `static/config.js` — filled with real SPREADSHEET_ID and OAUTH_CLIENT_ID
3. GitHub repo — set to public, Pages enabled on `main` / `/static`

---

## Key Conventions

- Row IDs are stored in column A of each sheet; `updateRowById`/`deleteRowById` look up by that value.
- Budget sheet uses the year string (e.g. `2025/2026`) as its column-A identifier instead of a numeric ID.
- `seedSheets()` runs at startup after sign-in — no-op if tabs already have content.
- Hebrew column names are used as-is in JS object keys, matching the sheet headers.
- OAuth token is stored in `sessionStorage` (cleared on tab close). GIS auto-refreshes silently after expiry.
- No build step. No Node dependencies for runtime. CDN-loaded: Chart.js, flatpickr, GIS.

---

## Frontend Features (app.js)

- **Collapsible sections** (KPIs, Charts, Reserves, Journal) with `localStorage` persistence.
- **Department filter** in journal and chart views; cascading supplier dropdown.
- **Duplicate detection** — visual marking + filter button in journal.
- **Supplier combobox** with department assignment in transaction form.
- **Charge/Credit toggle** in transaction modal (journal indicators).
- **Expand/Collapse All** button for journal entries.
- **Hebrew date picker** via flatpickr (RTL, dd/mm/yyyy).
- **Version tag** from `APP_VERSION` constant in `config.js`.
