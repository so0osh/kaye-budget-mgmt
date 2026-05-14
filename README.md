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

### 1. Download the latest release

Go to the [Releases page](https://github.com/so0osh/kaye-budget-mgmt/releases/latest) and download the zip archive, then extract it to a folder of your choice.

#### For developers — clone instead

If you have Git and GitHub access, you can clone the repository:

```bash
git clone <repo-url>
cd kaye-budget-mgmt
```

### 2. Copy and fill in `config.json`

Copy `config.template.json` to `config.json` and fill in both fields:

```json
{
  "spreadsheet_id": "YOUR_SPREADSHEET_ID_HERE",
  "github_pat":     "YOUR_GITHUB_PAT_HERE"
}
```

`github_pat` is a GitHub fine-grained personal access token with **Contents: Read-only** access to this repository. Create one at GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.

> **Important:** Never commit `config.json` — it contains your credentials. It is listed in `.gitignore` to prevent accidental commits.

### 3. Add `credentials.json`

Place your Google service-account key file (named `credentials.json`) in the same folder.

### 4. Double-click `launch.bat`

The launcher will automatically:
- Install Python 3.12.7 if not already installed (no admin rights required)
- Download and apply any newer release from GitHub
- Set up the Python virtual environment on first run
- Open the app in your browser at `http://localhost:13885`

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

The app starts on `http://localhost:13885` and opens a browser tab automatically.

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
app.py                 Flask app + REST API routes
sheets.py              Google Sheets read/write/delete helpers
config.template.json   Template for config.json (check in, users copy to config.json)
config.json            Spreadsheet ID and GitHub PAT (never commit — .gitignore)
credentials.json       Service-account key (never commit — .gitignore)
requirements.txt       Python dependencies
launch.bat             Windows launcher for non-technical users
static/
  index.html           Single-page application shell
  style.css            Styles
  app.js               Frontend logic
tests/
  conftest.py          Pytest fixtures
  test_api.py          API integration tests
```

---

## Environment Files (never commit)

| File | Description |
|------|-------------|
| `credentials.json` | Google service-account private key |
| `config.json` | Contains the live spreadsheet ID and GitHub PAT |

Make sure both are listed in `.gitignore`. Use `config.template.json` as a reference for the required fields in `config.json`.
