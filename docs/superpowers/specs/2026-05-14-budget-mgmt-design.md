# Budget Management Dashboard — Design Spec
**Date:** 2026-05-14  
**Project:** `C:\repos\budget-mgmt`  
**Status:** Approved — ready for implementation

---

## 1. Overview

A Hebrew, RTL, single-page web application for managing the annual marketing and promotional budget of the registration office (מדור רישום) at Kaye Academic College (מכללת קיי). Built as a personal tool for one user. Data is stored in a private Google Sheet accessed via a service account. The app is served locally via a minimal Python/Flask server.

Color palette and visual identity are inspired by [kaye.ac.il](https://kaye.ac.il) light mode:
- Primary teal: `#1594a0`
- Secondary pink: `#cd3468`
- Background: `#f2f4f6`
- Card background: `#ffffff`
- Text: `#0a0a0a`
- Muted: `#727272`
- Borders: `#e2e2e2`, `#d1d1d1`
- Accent green: `#2bac76`, amber: `#e08c1a`

Font: **Heebo** (Google Fonts) — ideal for Hebrew/Latin mixed content.

---

## 2. Architecture

```
budget-mgmt/
├── app.py                  ← Flask server (~150 lines)
├── credentials.json        ← Google service account key (gitignored)
├── requirements.txt        ← flask, google-auth, google-api-python-client
├── .gitignore
└── static/
    ├── index.html          ← Single page, Hebrew RTL
    ├── style.css
    └── app.js              ← All UI logic; calls /api/* endpoints
```

### Startup
```
python app.py
```
Flask binds to `http://localhost:5000` and opens the browser automatically (`webbrowser.open`).

### Flask API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/data` | Read all 5 sheets in one call; returns JSON |
| `POST` | `/api/transaction` | Create / update / delete a transaction row |
| `POST` | `/api/reserve` | Create / update / delete a reserve row |
| `GET/POST` | `/api/settings` | Read/write suppliers, statuses, year config |

All write operations send the full row as JSON. Flask proxies to Google Sheets API using the service account. The service account key (`credentials.json`) never leaves the server — the browser only speaks to `localhost`.

### Google Sheets setup
1. Create a Google Sheet named `ניהול תקציב פרסום`.
2. Create a Google Cloud project, enable the Sheets API, create a service account, download `credentials.json`.
3. Share the sheet with the service account email (Editor role).
4. Place `credentials.json` in the project root.

---

## 3. Google Sheets Schema

Row 1 in every sheet is a **header row** (Hebrew column names). Data starts from row 2. IDs are generated as `Date.now()` strings (millisecond timestamps) — unique and sortable. No formulas in any sheet; all calculations are performed in frontend JS.

### Sheet 1 — `תקציב` (Years / Opening Budget)
| Column | Hebrew header | Type | Notes |
|--------|--------------|------|-------|
| A | שנה | string | e.g. `2025/2026` |
| B | תקציב_פתיחה | number | Opening budget in NIS |
| C | חודש_סיום | number | End month (1–12); default 8 (August) |

### Sheet 2 — `תנועות` (Transactions)
| Column | Hebrew header | Type | Notes |
|--------|--------------|------|-------|
| A | id | string | Timestamp ID |
| B | שנה | string | Foreign key → תקציב.שנה |
| C | תאריך | string | `DD/MM/YYYY` |
| D | ספק | string | Foreign key → ספקים.שם |
| E | מס_חשבונית | string | Invoice number (free text) |
| F | תיאור | string | Description (optional) |
| G | סכום | number | Amount in NIS (positive) |
| H | סטטוס | string | Foreign key → סטטוסים.שם |

### Sheet 3 — `ספקים` (Suppliers)
| Column | Hebrew header | Type | Notes |
|--------|--------------|------|-------|
| A | id | string | Timestamp ID |
| B | שם | string | Supplier display name |
| C | פעיל | boolean | `TRUE`/`FALSE`; inactive suppliers hidden from dropdowns |

### Sheet 4 — `סטטוסים` (Statuses)
| Column | Hebrew header | Type | Notes |
|--------|--------------|------|-------|
| A | id | string | Timestamp ID |
| B | שם | string | Status display name |
| C | צבע | string | Hex color for badge (e.g. `#2bac76`) |

### Sheet 5 — `שמורות` (Reserves)
| Column | Hebrew header | Type | Notes |
|--------|--------------|------|-------|
| A | id | string | Timestamp ID |
| B | שנה | string | Foreign key → תקציב.שנה |
| C | שם | string | Reserve bucket name |
| D | סכום | number | Reserved amount in NIS |
| E | תיאור | string | Purpose / description |

---

## 4. UI Sections

The page is a single scrollable document, RTL, in Hebrew. A sticky header is always visible. Sections flow top-to-bottom in this order:

### 4.1 Header (sticky)
- **Right:** Logo square (ק) + title "ניהול תקציב פרסום" + subtitle "מדור רישום — מכללת קיי"
- **Left:** Year selector dropdown (auto-selects current year on load) | Print button | Settings button | "הוסף תנועה" primary CTA button
- Bordered bottom with 3px teal line (`#1594a0`). Subtle drop shadow.

### 4.2 KPI Cards (8 cards, 4-column grid)
All values are computed from raw sheet data. Cards have a colored right border per category.

| Card | Calculation | Border color |
|------|------------|--------------|
| תקציב שנתי | `תקציב.תקציב_פתיחה` for selected year | teal |
| הוצאות עד היום | `SUM(תנועות.סכום)` for selected year | pink |
| יתרה נוכחית | תקציב שנתי − הוצאות עד היום | green |
| סכום שמור | `SUM(שמורות.סכום)` for selected year | amber |
| יתרה תפעולית | יתרה נוכחית − סכום שמור | teal |
| חודשים שנותרו | months from today until `חודש_סיום` of selected year; minimum 0 if past end month | green |
| תקציב חודשי מותר | יתרה תפעולית ÷ חודשים שנותרו | amber |
| אחוז ניצול | הוצאות עד היום ÷ תקציב שנתי × 100 | pink |

The "הוצאות עד היום" card includes a thin progress bar showing utilization %.

### 4.3 Charts (2-column: 2fr + 1fr)

**Monthly bar chart (left, larger):**
- X-axis: months of the selected academic year (Sep → Aug or until חודש_סיום)
- Y-axis: NIS amount
- Each supplier is a distinct color (assigned consistently from a fixed palette)
- Toggle control (pill buttons top-right): **מוערם** (stacked) / **זה לצד זה** (grouped)
- Animated 300ms transition on toggle

**Supplier doughnut chart (right):**
- One slice per supplier, colored consistently with bar chart
- Cutout: 62%
- Legend below chart
- Tooltip shows: `ספק: ₪סכום (XX.X%)`

### 4.4 Reserved Amounts
- One card per `שמורות` row for the selected year
- Top border color cycles through accent colors
- Each card: name, amount (large, colored), description
- "+ הוסף שמור" dashed add-card at the end
- Each card has edit/delete icon buttons

### 4.5 Transaction Journal
- **Month carousel:** scrollable pill strip (← ספט׳ אוק׳ נוב׳ … →) + "הכל" pill. Auto-focuses current month on load. Carousel arrows scroll the strip when months overflow.
- **Filters row** (below carousel): dropdowns for supplier, status; clear button. Filters apply on top of the selected month.
- **Table columns:** תאריך | ספק (with color dot) | מס׳ חשבונית | תיאור | סכום | סטטוס | actions (edit / delete)
- **Footer:** transaction count + selected period label on the left; month total (SUM) on the right in pink.
- **Print button** in journal header prints the visible filtered table.

---

## 5. CRUD Interactions

### Add / Edit Transaction
Modal dialog (overlay). Fields:
- תאריך — date picker
- ספק — dropdown (active suppliers only) + inline "נהל ספקים" link
- מס׳ חשבונית — text input
- תיאור — text input (optional)
- סכום — number input (NIS)
- סטטוס — dropdown + inline "נהל סטטוסים" link

Save → POST `/api/transaction` → optimistic UI update → re-render.

### Manage Suppliers / Statuses
Small inline management panel (expandable or mini-modal):
- List current items with edit/delete per row
- "הוסף" input at the bottom
- Changes persist immediately to Google Sheets

### Delete
Confirmation prompt before any delete. Soft confirmation (inline "בטל / אשר" row highlight rather than browser dialog).

---

## 6. Settings Panel
Accessible from header ⚙ button. Slide-in drawer or modal:
- **חודש סיום שנה** — number 1–12 (default 8)
- **שנים** — manage academic years (add new year with opening budget)
- Saved to `תקציב` sheet

---

## 7. Print Support
- `@media print` CSS: hides header buttons, filters, carousel arrows, action columns
- Print button triggers `window.print()`
- Charts render as static images in print view (Chart.js canvas prints natively)
- Clean table layout for print, no colored backgrounds on rows

---

## 8. Data Flow

```
Browser (app.js)
    │
    ├─ on load ──► GET /api/data ──► Flask ──► Sheets API (read all 5 sheets)
    │                                          └─► returns JSON to browser
    │
    ├─ year change ──► re-compute all KPIs and re-render charts from cached data
    │
    └─ write action ──► POST /api/transaction|reserve|settings
                        └─► Flask ──► Sheets API (append/update/delete row)
                            └─► returns updated row ──► optimistic UI update
```

All data is loaded once on page load and cached in memory (`window.appData`). Year/month/filter changes re-render from the cache — no additional network calls. Write operations update both Google Sheets and the local cache.

---

## 9. Google Sheets initial template
On first run (empty sheet), `app.py` seeds the 5 sheets with header rows and one example year row (`2025/2026`, budget `0`) so the UI has something to display. The user then sets the real opening budget from the Settings panel or directly in the sheet.

---

## 10. Deployment & Updates

### Distribution model
Code lives in a **private GitHub repository**. The end user's machine has a cloned copy. Updates are delivered by pushing to GitHub; the user receives them automatically on next launch — no manual steps required.

### User startup (desktop shortcut)
A `Start Budget App.bat` file sits on the desktop. Double-clicking it:
1. Pulls latest code from GitHub (`git pull --quiet`)
2. Starts Flask (`python app.py`)
3. Opens the browser automatically (`webbrowser.open` inside `app.py`)

```bat
@echo off
cd /d "C:\repos\budget-mgmt"
git pull --quiet
python app.py
```

The shortcut can be given a custom icon for a polished look.

### One-time setup on the user's machine
- Install Git and Python (one-time, done by the developer)
- `git clone <private-repo-url>`
- `git config credential.helper wincred` — stores GitHub credentials in Windows Credential Manager so `git pull` never prompts
- Copy `credentials.json` manually (USB / shared drive) — done once; never committed to git

### Security
- GitHub repo is private — only the developer has push access
- `credentials.json` is in `.gitignore` — never uploaded to GitHub; lives only on the machines that need it
- No credentials are ever exposed to the browser

---

## 11. Out of Scope
- Multi-user access / authentication UI
- Budget categories / sub-categories hierarchy (flat transaction list only)
- Email notifications or reminders
- Mobile-optimized layout (desktop-first, readable on tablet)
- Offline mode
