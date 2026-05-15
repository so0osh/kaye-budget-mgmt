# Feature Design: Budget Manager — May 2026 Feature Batch

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Eight features added to the kaye-budget-mgmt SPA (vanilla JS + Flask + Google Sheets).

---

## 1. Data Model Changes

### New sheet: `מחלקות` (departments)
Columns: `id`, `שם`, `ברירת_מחדל` (TRUE/FALSE — only one row may be TRUE at a time)

### Modified: `ספקים` (suppliers)
Add column `מחלקה` (dept name string; empty = unassigned). Existing rows default to empty.

### Modified: `תנועות` (transactions)
Add column `מחלקה` (dept name string; stored at save time). Mandatory — cannot be blank.

### `sheets.py`
- Add `'departments': 'מחלקות'` to `SHEET_NAMES`
- Add `['id', 'שם', 'ברירת_מחדל']` to `COLUMNS['departments']`
- Add empty list to `SEED_DATA['departments']`
- `COLUMNS['suppliers']` → `['id', 'שם', 'פעיל', 'מחלקה']`
- `COLUMNS['transactions']` → `['id', 'שנה', 'תאריך', 'ספק', 'מס_חשבונית', 'תיאור', 'סכום', 'סטטוס', 'מחלקה']`

### `app.py`
- `/api/data` already returns all sheets — departments included automatically
- `/api/settings` gains `type: 'department'` — create/update/delete, same pattern as supplier/status
- `/api/transaction` create + update include `מחלקה` in the values list
- `/api/settings` supplier update includes `מחלקה`
- New `GET /api/version` endpoint — reads `version.txt`, returns `{ version: "v1.3.0" }`

### `APP` state additions
```js
APP.filter = { supplier: '', status: '', dept: '', duplicates: false, chartDept: '' }
APP.version = ''   // loaded once on init
```

---

## 2. Duplicate Detection & Filter

### Detection
- On every `render()`, build `duplicateIds` — a `Set` of transaction `id`s where `(ספק + '::' + מס_חשבונית)` appears more than once across **all** of `APP.raw.transactions` (all years). Rows with empty invoice number are excluded.
- Stored on `APP.duplicateIds` so `renderJournal` and the filter can both read it.

### Visual marking
- Duplicate rows receive CSS class `row-duplicate`: subtle amber left border (`#e08c1a`) + pale amber background tint.
- A small `כפול` badge (amber, same style as status badges) appears in the invoice cell beside the number.
- Marks disappear automatically when `render()` is called after a save that resolves the conflict.

### Duplicate filter button
- Added to `.journal-filters` bar: `<button id="filter-duplicates">⚠ כפילויות</button>`
- Toggles `APP.filter.duplicates` boolean.
- Active state: teal border + teal text (same active-pill style as month pills).
- `getFilteredTransactions()` additionally filters to rows in `APP.duplicateIds` when active.
- Reset by the existing "✕ נקה" clear-filters button.

---

## 3. Departments — Form Field & Management

### Transaction form
- New `מחלקה` row added **above** the supplier row in `_restoreTransactionForm()`.
- `<select id="txn-dept">` — no empty option; department is mandatory.
- On open (new transaction): auto-selects the dept where `ברירת_מחדל === 'TRUE'`; falls back to first dept if none marked.
- Link-button `נהל מחלקות` next to the label, same pattern as existing manage links.

### Dept → Supplier cascade
- `onchange` on `#txn-dept` calls `updateSuppliersByDept(deptName)`.
- Filters `APP.raw.suppliers` to active suppliers whose `מחלקה` matches selected dept.
- Rebuilds `#txn-supplier-input` combobox options.
- Retains current supplier value if still in the new list; clears it otherwise.
- On edit-open: dept is set first, supplier applied second — cascade runs before supplier value is restored.

### Manage Departments modal
- Small modal (`modal-sm`), same pattern as suppliers/statuses.
- Each dept row: `[radio name="dept-default"] [dept name] [✕ delete]`
- Radio pre-checked for the dept with `ברירת_מחדל === 'TRUE'`.
- Clicking a radio calls `setDefaultDept(id)` → POST update: set previous default to FALSE, new to TRUE (both in one logical operation, two sequential API calls).
- Add row: text input + "הוסף" button.
- No color picker needed.
- On close: refreshes `#txn-dept` in transaction form if open.

### Manage Suppliers modal update
- Dept filter dropdown added at the top: "הצג מחלקה: [כל המחלקות | dept1 | dept2 …]"
- Defaults to the currently selected dept in the transaction form when opened from it.
- Each supplier row gains a `<select>` showing all depts + "ללא מחלקה" (unassigned), pre-selected to current dept.
- `onchange` calls `updateSupplierDept(id, deptName)` → POST `/api/settings` with `type: 'supplier', action: 'update'`.

---

## 4. Supplier Combobox

Replaces `<select id="txn-supplier">` in the transaction form.

### Structure
```html
<div class="combobox-wrap">
  <input type="text"   id="txn-supplier-input" class="form-input" autocomplete="off">
  <input type="hidden" id="txn-supplier">
  <div  id="txn-supplier-list" class="combobox-list hidden"></div>
</div>
```

### Behaviour (implemented as `buildCombobox(inputEl, hiddenEl, getOptions)`)
- Typing filters the floating list (case-insensitive, matches anywhere in name).
- Clicking an item sets both the visible input text and the hidden value.
- On blur (with small delay for click to register): if typed text does not exactly match a valid supplier, input is cleared and hidden value reset to `""`.
- Keyboard: ↑/↓ moves highlight, Enter selects, Escape closes.
- RTL-safe: list opens below the input, aligned to the right edge.

### Styling
- `.combobox-wrap` — `position: relative`
- `.combobox-list` — `position: absolute; top: 100%; right: 0; left: 0; z-index: 200` — card shadow, max-height with scroll
- `.combobox-item` — hover highlight in teal tint; `.combobox-item.active` — keyboard-highlighted item

---

## 5. Department Filters

### Journal filter bar
- New `<select id="filter-dept">` added before `#filter-supplier`.
- Options: "כל המחלקות" + all dept names from `APP.raw.departments`.
- `onchange` triggers `applyFilters()`.
- When a dept is selected, `#filter-supplier` is repopulated to only show suppliers of that dept (+ "כל הספקים").
- `clearFilters()` resets dept to `""` and restores all suppliers in the supplier filter.
- `APP.filter.dept` added to `getFilteredTransactions()` filter chain.

### Charts dept filter
- `<select id="chart-dept-filter">` added in the charts section header, beside the stacked/grouped toggle.
- Options: "כל המחלקות" + all dept names.
- `onchange` sets `APP.filter.chartDept` and calls `renderCharts()`.
- `buildChartData()` filters `active` suppliers to those matching `APP.filter.chartDept` (or all if empty).
- Affects both bar chart and pie chart.

---

## 6. Collapsible Sections

### Markup
Each section gets a wrapper `<div class="section-block" data-section="kpis|charts|reserves|journal">`. The `.section-title` becomes the toggle trigger. A `<span class="section-chevron">›</span>` is inserted as the first child inside `.section-title` (appears on the right in RTL, beside the accent bar). Content lives in a sibling `<div class="section-body">`.

### Behaviour
- Clicking `.section-title` toggles the `expanded` boolean for that section.
- `section-body` transitions via `max-height`: `0` → `measured scrollHeight` (250ms ease).
- Chevron rotates 90° (`transform: rotate(90deg)`) when expanded.

### State
- localStorage key: `kaye_sections`
- JSON: `{ kpis: false, charts: false, reserves: false, journal: true }`
- Read on `DOMContentLoaded` before first render; if key absent, defaults above apply.
- Written after every toggle.

---

## 7. Version Tag

### Web page
- `loadData()` also fetches `GET /api/version` and stores result in `APP.version`.
- A `<span id="app-version" class="version-tag"></span>` is added in the header, between the subtitle and the right-side actions.
- Populated after fetch: `document.getElementById('app-version').textContent = APP.version`
- CSS: `font-size: 11px; color: #727272; background: #f0f0f0; border-radius: 20px; padding: 2px 8px;`

### Splash (launcher.py)
- At startup, read `version.txt` from `APP_DIR` (already available).
- Append the version string to the existing subtitle/status label in the Tkinter splash.

---

## Implementation Order

1. Backend: `sheets.py` + `app.py` schema + dept CRUD + version endpoint
2. Duplicate detection logic + visual marking + filter button
3. Department data model wired into frontend (`APP.raw.departments`)
4. Department form field + manage modal + default-dept logic
5. Supplier modal dept filter + per-supplier dept assignment
6. Dept → supplier cascade in transaction form
7. Supplier combobox (replaces select)
8. Journal dept filter + chart dept filter
9. Collapsible sections + localStorage persistence
10. Version tag (web + splash)
