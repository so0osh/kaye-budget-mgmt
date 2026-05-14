# ניהול תקציב פרסום — Advertising Budget Manager

A lightweight web app for tracking advertising spend against a Google Sheets spreadsheet.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.10+ |
| Node.js | 18+ (only needed for the xlsx import utility) |
| A Google account | — |

---

## Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd kaye-budget-mgmt
```

### 2. Create a Python virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. (Optional) Install JS dependencies

Only needed if you use the xlsx import utility.

```bash
npm install
```

---

## Google Sheets Setup

### Step 1 — Create a Google Cloud project and service account

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable the **Google Sheets API** for the project.
4. Go to **IAM & Admin → Service Accounts** and create a new service account.
5. Grant it the **Editor** role (or a custom role with Sheets read/write).
6. Under **Keys**, add a new JSON key and download it.
7. Rename the downloaded file to `credentials.json` and place it in the project root.

### Step 2 — Create the Google Spreadsheet

1. Create a new Google Sheet.
2. Add the following tabs with **these exact Hebrew names**:

   | Tab name  | Purpose                        |
   |-----------|--------------------------------|
   | תקציב     | Fiscal years + opening budgets |
   | תנועות    | Transactions                   |
   | ספקים     | Suppliers                      |
   | סטטוסים   | Statuses                       |
   | שמורות    | Reserves                       |

3. Share the spreadsheet with the service account email (found in `credentials.json` under `client_email`), granting **Editor** access.

### Step 3 — Configure the app

Open `config.json` and paste the spreadsheet ID (the long string in the Google Sheets URL between `/d/` and `/edit`):

```json
{
  "spreadsheet_id": "YOUR_SPREADSHEET_ID_HERE"
}
```

---

## Running the App

```bash
python app.py
```

The app starts on `http://localhost:5000` and opens a browser tab automatically.

On first run, `sheets.seed_sheets()` writes headers and default data (suppliers, statuses, a sample budget year) to any empty tabs.

---

## Running Tests

```bash
pytest
```

Tests use a Flask test client with `TESTING=True` so no Google Sheets connection is required.

---

## Project Structure

```
app.py              Flask app + REST API routes
sheets.py           Google Sheets read/write/delete helpers
config.json         Spreadsheet ID (fill in before first run)
credentials.json    Service-account key (never commit — add to .gitignore)
requirements.txt    Python dependencies
static/
  index.html        Single-page application shell
  style.css         Styles
  app.js            Frontend logic
tests/
  conftest.py       Pytest fixtures
  test_api.py       API integration tests
```

---

## Environment Files (never commit)

| File | Description |
|------|-------------|
| `credentials.json` | Google service-account private key |
| `config.json` | Contains the live spreadsheet ID |

Make sure both are listed in `.gitignore`.
