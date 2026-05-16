# CLAUDE.md

## Project Overview

**kaye-budget-mgmt** is an advertising budget management web app (ניהול תקציב פרסום).

- **Backend**: Python / Flask (`app.py`, `sheets.py`)
- **Frontend**: Vanilla JS / HTML / CSS (`static/`)
- **Data store**: Google Sheets via the Google Sheets API v4
- **Tests**: pytest (`tests/`)
- **Current version**: see `version.txt` (e.g. `v1.3.1`)

---

## Architecture

```
app.py              — Flask app factory + all REST endpoints
sheets.py           — Google Sheets read/write/delete helpers + seed logic
launcher.py         — Tkinter splash UI, auto-update check, starts Flask server
launch.vbs          — Silent user-facing entry point (no console window)
launch.bat          — Python install helper, hands off to launcher.py
generate_icon.py    — Generates icon.png / launch.ico from icon-params.md
config.json         — { "spreadsheet_id": "<id>", "github_pat": "", "debug": false }  (not committed with real values)
config.template.json— Template for new installs (committed, no secrets)
credentials.json    — Google service-account key (never commit)
version.txt         — Current semver tag written by CI on release
static/             — index.html, style.css, app.js (served as SPA)
tests/              — pytest suite (conftest.py + test_api.py + test_launcher.py)
.github/workflows/  — release-asset.yml: packages release zip on GitHub release publish
```

Google Sheets tabs (Hebrew names, mapped in `sheets.py::SHEET_NAMES`):

| Key           | Tab name   | Purpose                                      |
|---------------|------------|----------------------------------------------|
| `budget`      | תקציב      | Fiscal years + opening budgets               |
| `transactions`| תנועות     | Individual spend transactions                |
| `suppliers`   | ספקים      | Supplier list (with optional dept assignment)|
| `statuses`    | סטטוסים    | Transaction status definitions               |
| `reserves`    | שמורות     | Budget reserves / earmarks                   |
| `departments` | מחלקות     | Department list                              |

---

## Common Commands

```bash
# Run the app (opens browser automatically)
python app.py

# Launch via splash screen (Windows user-facing)
launch.vbs        # silent, no console
launch.bat        # shows console, falls through to launcher.py

# Run tests
pytest

# Install Python dependencies
pip install -r requirements.txt

# Install JS dev dependencies (xlsx import tool)
npm install
```

---

## Environment Setup

Two files are required at the project root and are **not committed**:

1. `credentials.json` — Google service-account key with Sheets access
2. `config.json` — copy from `config.template.json` and fill in:
   - `spreadsheet_id` — target Google Sheet ID
   - `github_pat` — GitHub personal access token (used by launcher for update checks)
   - `debug` — set `true` to skip auto-update check on launch

---

## API Endpoints

| Method | Path               | Description                                             |
|--------|--------------------|---------------------------------------------------------|
| GET    | `/`                | Serves the SPA (`index.html`)                           |
| GET    | `/api/data`        | Returns all sheets as JSON                              |
| POST   | `/api/transaction` | CRUD for transactions (action: create/update/delete)    |
| POST   | `/api/reserve`     | CRUD for reserves                                       |
| GET    | `/api/settings`    | Returns suppliers, statuses, budget rows, departments   |
| POST   | `/api/settings`    | CRUD for suppliers, statuses, years, departments        |
| GET    | `/api/version`     | Returns `{ version }` from `version.txt`                |

---

## Key Conventions

- Row IDs are stored in column A of each sheet; CRUD helpers look up by that value.
- `sheets.seed_sheets()` runs at startup and writes headers + default data only to **empty** tabs — it is a no-op if a tab already has content.
- Hebrew column names are used as-is throughout the API payloads.
- The Flask app runs on **port 13885** and is **not** run in debug mode when launched directly.
- Tests use a separate `TESTING=True` config so `seed_sheets()` is skipped.
- `launcher.py` kills any stale process on port 13885 before starting a fresh Flask server.

---

## Schema Changes (since initial release)

### Transactions (`תנועות`)
Added column: `מחלקה` (department) — optional, stored as 9th column.

### Suppliers (`ספקים`)
Added column: `מחלקה` (department assignment) — optional, stored as 4th column.

### Departments (`מחלקות`) — new sheet
Columns: `id`, `שם`, `ברירת_מחדל`.
Managed via Settings modal; assigned to suppliers and transactions.

---

## Frontend Features (app.js)

- **Collapsible sections** (KPIs, Charts, Reserves, Journal) with `localStorage` persistence.
- **Department filter** in journal and chart views; cascading supplier dropdown.
- **Duplicate detection** — visual marking + filter button in journal.
- **Supplier combobox** with department assignment in transaction form.
- **Charge/Credit toggle** in transaction modal (journal indicators).
- **Expand/Collapse All** button for journal entries.
- **Hebrew date picker** via flatpickr (RTL, dd/mm/yyyy).
- **Version tag** displayed in header and splash screen.

---

## Launcher (`launcher.py`)

- Shows a styled Tkinter splash window on startup.
- Checks GitHub releases for a newer version (using `github_pat` from `config.json`).
- Queues Hebrew-translated status messages to the splash UI.
- Kills any stale process on port 13885 before starting Flask.
- Set `"debug": true` in `config.json` to skip the auto-update check.

---

## CI / Release

GitHub Actions workflow (`.github/workflows/release-asset.yml`) triggers on release publish:
1. Writes the tag name to `version.txt`.
2. Packages a release zip containing: `app.py`, `sheets.py`, `requirements.txt`, `launch.bat`, `launch.vbs`, `launcher.py`, `icon.png`, `launch.ico`, `version.txt`, `config.template.json`, `static/`.
3. Uploads the zip as a release asset.
