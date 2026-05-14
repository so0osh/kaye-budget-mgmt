# CLAUDE.md

## Project Overview

**kaye-budget-mgmt** is an advertising budget management web app (ניהול תקציב פרסום).

- **Backend**: Python / Flask (`app.py`, `sheets.py`)
- **Frontend**: Vanilla JS / HTML / CSS (`static/`)
- **Data store**: Google Sheets via the Google Sheets API v4
- **Tests**: pytest (`tests/`)

---

## Architecture

```
app.py        — Flask app factory + all REST endpoints
sheets.py     — Google Sheets read/write/delete helpers + seed logic
config.json   — Holds { "spreadsheet_id": "<id>" }  (not committed with real ID)
credentials.json — Google service-account key (never commit)
static/       — index.html, style.css, app.js (served as SPA)
tests/        — pytest suite (conftest.py + test_api.py)
```

Google Sheets tabs (Hebrew names, mapped in `sheets.py::SHEET_NAMES`):

| Key           | Tab name      | Purpose                        |
|---------------|---------------|--------------------------------|
| `budget`      | תקציב         | Fiscal years + opening budgets |
| `transactions`| תנועות        | Individual spend transactions  |
| `suppliers`   | ספקים         | Supplier list                  |
| `statuses`    | סטטוסים       | Transaction status definitions |
| `reserves`    | שמורות        | Budget reserves / earmarks     |

---

## Common Commands

```bash
# Run the app (opens browser automatically)
python app.py

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
2. `config.json` — set `spreadsheet_id` to the target Google Sheet ID

---

## API Endpoints

| Method | Path               | Description                              |
|--------|--------------------|------------------------------------------|
| GET    | `/`                | Serves the SPA (`index.html`)            |
| GET    | `/api/data`        | Returns all sheets as JSON               |
| POST   | `/api/transaction` | CRUD for transactions (action: create/update/delete) |
| POST   | `/api/reserve`     | CRUD for reserves                        |
| GET    | `/api/settings`    | Returns suppliers, statuses, budget rows |
| POST   | `/api/settings`    | CRUD for suppliers, statuses, years      |

---

## Key Conventions

- Row IDs are stored in column A of each sheet; CRUD helpers look up by that value.
- `sheets.seed_sheets()` runs at startup and writes headers + default data only to **empty** tabs — it is a no-op if a tab already has content.
- Hebrew column names are used as-is throughout the API payloads.
- The Flask app is **not** run in debug mode when launched directly (`python app.py`).
- Tests use a separate `TESTING=True` config so `seed_sheets()` is skipped.
