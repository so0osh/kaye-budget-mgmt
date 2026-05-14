# Budget Management Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Hebrew RTL, single-page budget management web app for Kaye College's registration office, backed by Google Sheets, served locally via Python/Flask.

**Architecture:** Flask thin proxy holds the Google service account credentials and exposes four API endpoints; the browser never talks to Google directly. All data is loaded once on startup and cached in `window.APP.raw`; year/month/filter changes re-render from cache without additional network calls. Write operations hit Flask → Sheets API then update the local cache optimistically.

**Tech Stack:** Python 3 + Flask, google-api-python-client, google-auth; vanilla JS (no build step), Chart.js via CDN, Heebo font via Google Fonts, pytest + unittest.mock for backend tests.

**Spec:** `docs/superpowers/specs/2026-05-14-budget-mgmt-design.md`

---

## File Map

```
budget-mgmt/
├── app.py                       ← Flask server + all API endpoints
├── sheets.py                    ← Google Sheets read/write helper
├── config.json                  ← { "spreadsheet_id": "..." }
├── credentials.json             ← service account key (gitignored)
├── requirements.txt
├── .gitignore
├── Start Budget App.bat         ← desktop launcher (git pull + python app.py)
├── tests/
│   ├── conftest.py              ← pytest fixtures
│   └── test_api.py             ← Flask endpoint tests (mocked sheets)
└── static/
    ├── index.html               ← single page, RTL Hebrew, all section HTML + modals
    ├── style.css                ← all styles + @media print
    └── app.js                   ← all frontend logic
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `.gitignore`
- Create: `requirements.txt`
- Create: `config.json`

- [ ] **Step 1: Initialise git and create .gitignore**

```bash
cd C:\repos\budget-mgmt
git init
```

Create `.gitignore`:
```
credentials.json
__pycache__/
*.pyc
.pytest_cache/
venv/
.env
```

- [ ] **Step 2: Create requirements.txt**

```
flask==3.1.0
google-api-python-client==2.163.0
google-auth==2.38.0
pytest==8.3.5
```

- [ ] **Step 3: Create config.json**

```json
{
  "spreadsheet_id": ""
}
```

(The user fills in the spreadsheet ID after creating the Google Sheet.)

- [ ] **Step 4: Create static/ folder and tests/ folder**

```bash
mkdir static
mkdir tests
```

- [ ] **Step 5: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: packages install without error.

- [ ] **Step 6: Commit**

```bash
git add .gitignore requirements.txt config.json
git commit -m "chore: project scaffold"
```

---

## Task 2: sheets.py — Google Sheets Helper

**Files:**
- Create: `sheets.py`

- [ ] **Step 1: Write sheets.py**

```python
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

SHEET_NAMES = {
    'budget':       'תקציב',
    'transactions': 'תנועות',
    'suppliers':    'ספקים',
    'statuses':     'סטטוסים',
    'reserves':     'שמורות',
}

# Column order for each sheet (matches spec schema)
COLUMNS = {
    'budget':       ['שנה', 'תקציב_פתיחה', 'חודש_סיום'],
    'transactions': ['id', 'שנה', 'תאריך', 'ספק', 'מס_חשבונית', 'תיאור', 'סכום', 'סטטוס'],
    'suppliers':    ['id', 'שם', 'פעיל'],
    'statuses':     ['id', 'שם', 'צבע'],
    'reserves':     ['id', 'שנה', 'שם', 'סכום', 'תיאור'],
}

SEED_DATA = {
    'budget':       [['2025/2026', '0', '8']],
    'transactions': [],
    'suppliers':    [
        ['1000000001', 'גוגל',             'TRUE'],
        ['1000000002', 'פייסבוק',          'TRUE'],
        ['1000000003', 'אינטרנטיק',        'TRUE'],
        ['1000000004', 'נרשמים',           'TRUE'],
        ['1000000005', 'לימודים בישראל',   'TRUE'],
    ],
    'statuses': [
        ['2000000001', 'שולם',          '#2bac76'],
        ['2000000002', 'ממתין לאישור',  '#e08c1a'],
        ['2000000003', 'מאושר',         '#1594a0'],
        ['2000000004', 'בוטל',          '#cd3468'],
    ],
    'reserves': [],
}

_svc = None
_sid = None
_sheet_ids = {}


def _init():
    global _svc, _sid
    if _svc is None:
        with open('config.json') as f:
            _sid = json.load(f)['spreadsheet_id']
        creds = Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
        _svc = build('sheets', 'v4', credentials=creds)


def _get_sheet_id(sheet_key):
    """Return the numeric sheetId for a named sheet (needed for row deletion)."""
    global _sheet_ids
    if sheet_key not in _sheet_ids:
        _init()
        meta = _svc.spreadsheets().get(spreadsheetId=_sid).execute()
        for s in meta['sheets']:
            for k, name in SHEET_NAMES.items():
                if s['properties']['title'] == name:
                    _sheet_ids[k] = s['properties']['sheetId']
    return _sheet_ids[sheet_key]


def _read_sheet(sheet_key):
    """Return list of dicts (header row → keys)."""
    _init()
    name = SHEET_NAMES[sheet_key]
    result = _svc.spreadsheets().values().get(
        spreadsheetId=_sid,
        range=f'{name}!A:Z'
    ).execute()
    values = result.get('values', [])
    if len(values) < 1:
        return []
    headers = values[0]
    rows = []
    for row in values[1:]:
        padded = row + [''] * (len(headers) - len(row))
        rows.append(dict(zip(headers, padded)))
    return rows


def read_all_sheets():
    return {key: _read_sheet(key) for key in SHEET_NAMES}


def append_row(sheet_key, values_list):
    """Append a list of values as a new row."""
    _init()
    name = SHEET_NAMES[sheet_key]
    _svc.spreadsheets().values().append(
        spreadsheetId=_sid,
        range=f'{name}!A1',
        valueInputOption='RAW',
        insertDataOption='INSERT_ROWS',
        body={'values': [values_list]}
    ).execute()


def update_row_by_id(sheet_key, row_id, values_list):
    """Find the row where column A == row_id and overwrite it."""
    _init()
    name = SHEET_NAMES[sheet_key]
    id_col = _svc.spreadsheets().values().get(
        spreadsheetId=_sid,
        range=f'{name}!A:A'
    ).execute().get('values', [])

    row_index = None
    for i, cell in enumerate(id_col):
        if cell and cell[0] == str(row_id):
            row_index = i + 1  # 1-based
            break
    if row_index is None:
        raise ValueError(f'Row {row_id} not found in {sheet_key}')

    _svc.spreadsheets().values().update(
        spreadsheetId=_sid,
        range=f'{name}!A{row_index}',
        valueInputOption='RAW',
        body={'values': [values_list]}
    ).execute()


def delete_row_by_id(sheet_key, row_id):
    """Find the row where column A == row_id and delete it."""
    _init()
    name = SHEET_NAMES[sheet_key]
    id_col = _svc.spreadsheets().values().get(
        spreadsheetId=_sid,
        range=f'{name}!A:A'
    ).execute().get('values', [])

    row_index = None
    for i, cell in enumerate(id_col):
        if cell and cell[0] == str(row_id):
            row_index = i  # 0-based for batchUpdate
            break
    if row_index is None:
        raise ValueError(f'Row {row_id} not found in {sheet_key}')

    sheet_id = _get_sheet_id(sheet_key)
    _svc.spreadsheets().batchUpdate(
        spreadsheetId=_sid,
        body={'requests': [{
            'deleteDimension': {
                'range': {
                    'sheetId': sheet_id,
                    'dimension': 'ROWS',
                    'startIndex': row_index,
                    'endIndex': row_index + 1,
                }
            }
        }]}
    ).execute()


def seed_sheets():
    """Write headers + seed data to all sheets if they are empty."""
    _init()
    for key, name in SHEET_NAMES.items():
        result = _svc.spreadsheets().values().get(
            spreadsheetId=_sid,
            range=f'{name}!A1:A1'
        ).execute()
        if result.get('values'):
            continue  # already has content

        headers = COLUMNS[key]
        rows = [headers] + SEED_DATA[key]
        _svc.spreadsheets().values().update(
            spreadsheetId=_sid,
            range=f'{name}!A1',
            valueInputOption='RAW',
            body={'values': rows}
        ).execute()
```

- [ ] **Step 2: Commit**

```bash
git add sheets.py
git commit -m "feat: Google Sheets helper (read, append, update, delete)"
```

---

## Task 3: app.py — Flask Server + /api/data

**Files:**
- Create: `app.py`

- [ ] **Step 1: Write app.py with /api/data**

```python
import webbrowser
import threading
from flask import Flask, jsonify, request, send_from_directory
import sheets


def create_app(config=None):
    app = Flask(__name__, static_folder='static', static_url_path='')

    if config:
        app.config.update(config)

    @app.route('/')
    def index():
        return send_from_directory('static', 'index.html')

    @app.route('/api/data')
    def get_data():
        try:
            data = sheets.read_all_sheets()
            return jsonify(data)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/transaction', methods=['POST'])
    def transaction():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501

    @app.route('/api/reserve', methods=['POST'])
    def reserve():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501

    @app.route('/api/settings', methods=['GET', 'POST'])
    def settings():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501

    return app


if __name__ == '__main__':
    app = create_app()
    threading.Timer(1.2, lambda: webbrowser.open('http://localhost:5000')).start()
    app.run(port=5000, debug=False)
```

- [ ] **Step 2: Commit**

```bash
git add app.py
git commit -m "feat: Flask server scaffold + /api/data endpoint"
```

---

## Task 4: app.py — /api/transaction Endpoint

**Files:**
- Modify: `app.py` (replace the stub `/api/transaction` route)

- [ ] **Step 1: Replace the transaction stub in app.py**

Replace:
```python
    @app.route('/api/transaction', methods=['POST'])
    def transaction():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501
```

With:
```python
    @app.route('/api/transaction', methods=['POST'])
    def transaction():
        try:
            body = request.get_json()
            action = body.get('action')

            if action == 'create':
                row = body['row']
                values = [
                    row['id'], row['שנה'], row['תאריך'], row['ספק'],
                    row['מס_חשבונית'], row['תיאור'], row['סכום'], row['סטטוס']
                ]
                sheets.append_row('transactions', values)
                return jsonify({'ok': True})

            elif action == 'update':
                row = body['row']
                values = [
                    row['id'], row['שנה'], row['תאריך'], row['ספק'],
                    row['מס_חשבונית'], row['תיאור'], row['סכום'], row['סטטוס']
                ]
                sheets.update_row_by_id('transactions', row['id'], values)
                return jsonify({'ok': True})

            elif action == 'delete':
                sheets.delete_row_by_id('transactions', body['id'])
                return jsonify({'ok': True})

            else:
                return jsonify({'ok': False, 'error': f'unknown action: {action}'}), 400

        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500
```

- [ ] **Step 2: Commit**

```bash
git add app.py
git commit -m "feat: /api/transaction endpoint (create/update/delete)"
```

---

## Task 5: app.py — /api/reserve, /api/settings, Sheet Seeding

**Files:**
- Modify: `app.py` (replace reserve and settings stubs; add seeding on startup)

- [ ] **Step 1: Replace /api/reserve stub**

Replace:
```python
    @app.route('/api/reserve', methods=['POST'])
    def reserve():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501
```

With:
```python
    @app.route('/api/reserve', methods=['POST'])
    def reserve():
        try:
            body = request.get_json()
            action = body.get('action')

            if action == 'create':
                row = body['row']
                values = [row['id'], row['שנה'], row['שם'], row['סכום'], row['תיאור']]
                sheets.append_row('reserves', values)
                return jsonify({'ok': True})

            elif action == 'update':
                row = body['row']
                values = [row['id'], row['שנה'], row['שם'], row['סכום'], row['תיאור']]
                sheets.update_row_by_id('reserves', row['id'], values)
                return jsonify({'ok': True})

            elif action == 'delete':
                sheets.delete_row_by_id('reserves', body['id'])
                return jsonify({'ok': True})

            else:
                return jsonify({'ok': False, 'error': f'unknown action: {action}'}), 400

        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500
```

- [ ] **Step 2: Replace /api/settings stub**

Replace:
```python
    @app.route('/api/settings', methods=['GET', 'POST'])
    def settings():
        return jsonify({'ok': False, 'error': 'not implemented'}), 501
```

With:
```python
    @app.route('/api/settings', methods=['GET', 'POST'])
    def settings():
        try:
            if request.method == 'GET':
                return jsonify({
                    'suppliers': sheets._read_sheet('suppliers'),
                    'statuses':  sheets._read_sheet('statuses'),
                    'budget':    sheets._read_sheet('budget'),
                })

            body = request.get_json()
            sheet_key = body['type']   # 'supplier' | 'status' | 'year'
            action = body['action']    # 'create' | 'update' | 'delete'

            if sheet_key == 'supplier':
                key = 'suppliers'
                if action == 'create':
                    row = body['row']
                    sheets.append_row(key, [row['id'], row['שם'], row['פעיל']])
                elif action == 'update':
                    row = body['row']
                    sheets.update_row_by_id(key, row['id'], [row['id'], row['שם'], row['פעיל']])
                elif action == 'delete':
                    sheets.delete_row_by_id(key, body['id'])

            elif sheet_key == 'status':
                key = 'statuses'
                if action == 'create':
                    row = body['row']
                    sheets.append_row(key, [row['id'], row['שם'], row['צבע']])
                elif action == 'update':
                    row = body['row']
                    sheets.update_row_by_id(key, row['id'], [row['id'], row['שם'], row['צבע']])
                elif action == 'delete':
                    sheets.delete_row_by_id(key, body['id'])

            elif sheet_key == 'year':
                row = body['row']
                existing = sheets._read_sheet('budget')
                match = next((r for r in existing if r['שנה'] == row['שנה']), None)
                if match or action == 'create':
                    if match:
                        sheets.update_row_by_id('budget', row['שנה'],
                            [row['שנה'], row['תקציב_פתיחה'], row['חודש_סיום']])
                    else:
                        sheets.append_row('budget',
                            [row['שנה'], row['תקציב_פתיחה'], row['חודש_סיום']])

            return jsonify({'ok': True})

        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500
```

Note: `year` uses the שנה string as its ID (not a timestamp) because it is a natural key.

- [ ] **Step 3: Add sheet seeding on app start**

At the top of `create_app()`, before the route definitions, add:

```python
    with app.app_context():
        if not app.config.get('TESTING'):
            try:
                sheets.seed_sheets()
            except Exception:
                pass  # no credentials yet during development
```

- [ ] **Step 4: Commit**

```bash
git add app.py
git commit -m "feat: /api/reserve, /api/settings endpoints + sheet seeding on startup"
```

---

## Task 6: Backend Tests

**Files:**
- Create: `tests/conftest.py`
- Create: `tests/test_api.py`

- [ ] **Step 1: Write tests/conftest.py**

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app({'TESTING': True})
    with app.test_client() as c:
        yield c
```

- [ ] **Step 2: Write tests/test_api.py**

```python
from unittest.mock import patch, MagicMock

MOCK_DATA = {
    'budget':       [{'שנה': '2025/2026', 'תקציב_פתיחה': '700000', 'חודש_סיום': '8'}],
    'transactions': [
        {'id': '111', 'שנה': '2025/2026', 'תאריך': '01/11/2025',
         'ספק': 'גוגל', 'מס_חשבונית': '123', 'תיאור': 'test', 'סכום': '2500', 'סטטוס': 'שולם'}
    ],
    'suppliers': [{'id': '1', 'שם': 'גוגל', 'פעיל': 'TRUE'}],
    'statuses':  [{'id': '2', 'שם': 'שולם', 'צבע': '#2bac76'}],
    'reserves':  [],
}

# ── /api/data ────────────────────────────────────────────────────────────────

@patch('app.sheets.read_all_sheets')
def test_get_data_returns_five_keys(mock_read, client):
    mock_read.return_value = MOCK_DATA
    r = client.get('/api/data')
    assert r.status_code == 200
    assert set(r.get_json().keys()) == {'budget', 'transactions', 'suppliers', 'statuses', 'reserves'}

@patch('app.sheets.read_all_sheets')
def test_get_data_error_returns_500(mock_read, client):
    mock_read.side_effect = Exception('api down')
    r = client.get('/api/data')
    assert r.status_code == 500
    assert 'error' in r.get_json()

# ── /api/transaction ─────────────────────────────────────────────────────────

TXN_ROW = {
    'id': '999', 'שנה': '2025/2026', 'תאריך': '01/01/2026',
    'ספק': 'גוגל', 'מס_חשבונית': '456', 'תיאור': '', 'סכום': '1000', 'סטטוס': 'שולם'
}

@patch('app.sheets.append_row')
def test_create_transaction(mock_append, client):
    r = client.post('/api/transaction', json={'action': 'create', 'row': TXN_ROW})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_append.assert_called_once_with('transactions', [
        '999', '2025/2026', '01/01/2026', 'גוגל', '456', '', '1000', 'שולם'
    ])

@patch('app.sheets.update_row_by_id')
def test_update_transaction(mock_update, client):
    r = client.post('/api/transaction', json={'action': 'update', 'row': TXN_ROW})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_update.assert_called_once()

@patch('app.sheets.delete_row_by_id')
def test_delete_transaction(mock_delete, client):
    r = client.post('/api/transaction', json={'action': 'delete', 'id': '111'})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_delete.assert_called_once_with('transactions', '111')

def test_transaction_unknown_action_returns_400(client):
    r = client.post('/api/transaction', json={'action': 'explode', 'row': TXN_ROW})
    assert r.status_code == 400

# ── /api/reserve ─────────────────────────────────────────────────────────────

RESERVE_ROW = {'id': '888', 'שנה': '2025/2026', 'שם': 'מלגות', 'סכום': '50000', 'תיאור': 'test'}

@patch('app.sheets.append_row')
def test_create_reserve(mock_append, client):
    r = client.post('/api/reserve', json={'action': 'create', 'row': RESERVE_ROW})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_append.assert_called_once_with('reserves', ['888', '2025/2026', 'מלגות', '50000', 'test'])

@patch('app.sheets.delete_row_by_id')
def test_delete_reserve(mock_delete, client):
    r = client.post('/api/reserve', json={'action': 'delete', 'id': '888'})
    assert r.status_code == 200
    mock_delete.assert_called_once_with('reserves', '888')

# ── /api/settings ─────────────────────────────────────────────────────────────

@patch('app.sheets._read_sheet')
def test_get_settings(mock_read, client):
    mock_read.return_value = []
    r = client.get('/api/settings')
    assert r.status_code == 200
    body = r.get_json()
    assert 'suppliers' in body and 'statuses' in body and 'budget' in body

@patch('app.sheets.append_row')
def test_create_supplier(mock_append, client):
    row = {'id': '777', 'שם': 'ספק חדש', 'פעיל': 'TRUE'}
    r = client.post('/api/settings', json={'type': 'supplier', 'action': 'create', 'row': row})
    assert r.status_code == 200
    mock_append.assert_called_once_with('suppliers', ['777', 'ספק חדש', 'TRUE'])

@patch('app.sheets.delete_row_by_id')
def test_delete_status(mock_delete, client):
    r = client.post('/api/settings', json={'type': 'status', 'action': 'delete', 'id': '2'})
    assert r.status_code == 200
    mock_delete.assert_called_once_with('statuses', '2')
```

- [ ] **Step 3: Run the tests**

```bash
pytest tests/ -v
```

Expected output (all pass):
```
tests/test_api.py::test_get_data_returns_five_keys PASSED
tests/test_api.py::test_get_data_error_returns_500 PASSED
tests/test_api.py::test_create_transaction PASSED
tests/test_api.py::test_update_transaction PASSED
tests/test_api.py::test_delete_transaction PASSED
tests/test_api.py::test_transaction_unknown_action_returns_400 PASSED
tests/test_api.py::test_create_reserve PASSED
tests/test_api.py::test_delete_reserve PASSED
tests/test_api.py::test_get_settings PASSED
tests/test_api.py::test_create_supplier PASSED
tests/test_api.py::test_delete_status PASSED
11 passed in ...
```

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test: Flask endpoint tests with mocked sheets"
```

---

## Task 7: HTML Skeleton + CSS

**Files:**
- Create: `static/index.html`
- Create: `static/style.css`

- [ ] **Step 1: Write static/index.html**

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ניהול תקציב פרסום</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
</head>
<body>

<!-- ═══════════ HEADER ═══════════ -->
<header class="app-header">
  <div class="header-brand">
    <div class="header-logo">ק</div>
    <div>
      <div class="header-title">ניהול תקציב פרסום</div>
      <div class="header-subtitle">מדור רישום — מכללת קיי</div>
    </div>
  </div>
  <div class="header-actions no-print">
    <select id="year-select" class="year-select"></select>
    <button class="btn btn-ghost" onclick="window.print()">🖨 הדפסה</button>
    <button class="btn btn-ghost" onclick="openSettings()">⚙ הגדרות</button>
    <button class="btn btn-primary" onclick="openTransactionModal(null)">+ הוסף תנועה</button>
  </div>
</header>

<div class="page">

  <!-- ═══════════ KPI CARDS ═══════════ -->
  <div class="section-title">סיכום תקציבי</div>
  <div id="kpi-grid" class="kpi-grid"></div>

  <!-- ═══════════ CHARTS ═══════════ -->
  <div class="section-title">גרפים</div>
  <div class="charts-row">
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title">הוצאות חודשיות לפי ספק</div>
          <div id="bar-legend" class="chart-legend"></div>
        </div>
        <div class="view-toggle no-print">
          <button class="view-toggle-btn active" id="btn-stacked" onclick="setBarMode('stacked')">מוערם</button>
          <button class="view-toggle-btn" id="btn-grouped" onclick="setBarMode('grouped')">זה לצד זה</button>
        </div>
      </div>
      <canvas id="bar-chart"></canvas>
    </div>
    <div class="chart-card">
      <div class="chart-header">
        <div class="chart-title">התפלגות לפי ספק</div>
      </div>
      <canvas id="pie-chart"></canvas>
    </div>
  </div>

  <!-- ═══════════ RESERVES ═══════════ -->
  <div class="section-title">סכומים שמורים</div>
  <div id="reserves-container" class="reserves-row"></div>

  <!-- ═══════════ JOURNAL ═══════════ -->
  <div class="section-title">יומן תנועות</div>
  <div class="journal-card">
    <div class="journal-header">
      <div class="month-carousel no-print">
        <button class="carousel-arrow" onclick="scrollCarousel(-1)">›</button>
        <div id="month-pills" class="month-pills"></div>
        <button class="carousel-arrow" onclick="scrollCarousel(1)">‹</button>
      </div>
      <div class="no-print" style="display:flex;gap:8px">
        <button class="btn btn-ghost" style="font-size:12px" onclick="printJournal()">🖨 הדפס</button>
        <button class="btn btn-outline" style="font-size:12px" onclick="openTransactionModal(null)">+ תנועה חדשה</button>
      </div>
    </div>
    <div class="journal-filters no-print">
      <span class="filter-label">סינון:</span>
      <select id="filter-supplier" class="filter-select" onchange="applyFilters()">
        <option value="">כל הספקים</option>
      </select>
      <select id="filter-status" class="filter-select" onchange="applyFilters()">
        <option value="">כל הסטטוסים</option>
      </select>
      <button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="clearFilters()">✕ נקה</button>
    </div>
    <table class="journal-table">
      <thead>
        <tr>
          <th>תאריך</th>
          <th>ספק</th>
          <th>מס׳ חשבונית</th>
          <th>תיאור</th>
          <th>סכום</th>
          <th>סטטוס</th>
          <th class="no-print"></th>
        </tr>
      </thead>
      <tbody id="journal-tbody"></tbody>
    </table>
    <div class="journal-footer">
      <div id="journal-count" style="font-size:12px;color:#727272"></div>
      <div class="journal-footer-total">סה״כ: <strong id="journal-total"></strong></div>
    </div>
  </div>

</div><!-- /page -->

<!-- ═══════════ TRANSACTION MODAL ═══════════ -->
<div id="modal-overlay" class="modal-overlay hidden" onclick="closeModal(event)">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span id="modal-title">הוספת תנועה</span>
      <button class="modal-close" onclick="closeTransactionModal()">✕</button>
    </div>
    <div class="modal-body">
      <input type="hidden" id="txn-id">
      <div class="form-row">
        <label>תאריך</label>
        <input type="date" id="txn-date" class="form-input">
      </div>
      <div class="form-row">
        <label>ספק <button class="link-btn no-print" onclick="openManageSuppliers()">נהל ספקים</button></label>
        <select id="txn-supplier" class="form-input"></select>
      </div>
      <div class="form-row">
        <label>מס׳ חשבונית</label>
        <input type="text" id="txn-invoice" class="form-input" placeholder="מספר חשבונית">
      </div>
      <div class="form-row">
        <label>תיאור</label>
        <input type="text" id="txn-description" class="form-input" placeholder="תיאור (אופציונלי)">
      </div>
      <div class="form-row">
        <label>סכום (₪)</label>
        <input type="number" id="txn-amount" class="form-input" min="0" step="0.01" placeholder="0.00">
      </div>
      <div class="form-row">
        <label>סטטוס <button class="link-btn no-print" onclick="openManageStatuses()">נהל סטטוסים</button></label>
        <select id="txn-status" class="form-input"></select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeTransactionModal()">ביטול</button>
      <button class="btn btn-primary" onclick="saveTransaction()">שמור</button>
    </div>
  </div>
</div>

<!-- ═══════════ MANAGE SUPPLIERS MODAL ═══════════ -->
<div id="suppliers-modal" class="modal-overlay hidden" onclick="closeModal(event)">
  <div class="modal modal-sm" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span>ניהול ספקים</span>
      <button class="modal-close" onclick="closeManageSuppliers()">✕</button>
    </div>
    <div class="modal-body">
      <div id="suppliers-list"></div>
      <div class="add-row">
        <input type="text" id="new-supplier-name" class="form-input" placeholder="שם ספק חדש">
        <button class="btn btn-primary btn-sm" onclick="addSupplier()">הוסף</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════ MANAGE STATUSES MODAL ═══════════ -->
<div id="statuses-modal" class="modal-overlay hidden" onclick="closeModal(event)">
  <div class="modal modal-sm" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span>ניהול סטטוסים</span>
      <button class="modal-close" onclick="closeManageStatuses()">✕</button>
    </div>
    <div class="modal-body">
      <div id="statuses-list"></div>
      <div class="add-row">
        <input type="text" id="new-status-name" class="form-input" placeholder="שם סטטוס חדש">
        <input type="color" id="new-status-color" value="#1594a0" style="width:36px;height:36px;border:none;cursor:pointer;border-radius:6px;">
        <button class="btn btn-primary btn-sm" onclick="addStatus()">הוסף</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════ SETTINGS PANEL ═══════════ -->
<div id="settings-overlay" class="modal-overlay hidden" onclick="closeSettings(event)">
  <div class="settings-panel" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span>הגדרות</span>
      <button class="modal-close" onclick="closeSettings()">✕</button>
    </div>
    <div class="modal-body">
      <h3 class="settings-section-title">שנים תקציביות</h3>
      <div id="years-list"></div>
      <div class="add-row" style="margin-top:12px">
        <input type="text" id="new-year-str" class="form-input" placeholder="2026/2027">
        <input type="number" id="new-year-budget" class="form-input" placeholder="תקציב פתיחה (₪)" min="0">
        <input type="number" id="new-year-endmonth" class="form-input" placeholder="חודש סיום (1-12)" min="1" max="12" value="8">
        <button class="btn btn-primary btn-sm" onclick="addYear()">הוסף</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════ DELETE CONFIRM ═══════════ -->
<div id="confirm-overlay" class="modal-overlay hidden" onclick="cancelDelete()">
  <div class="modal modal-xs" onclick="event.stopPropagation()">
    <div class="modal-body" style="text-align:center;padding:28px">
      <div style="font-size:16px;font-weight:700;margin-bottom:8px">מחיקת רשומה</div>
      <div id="confirm-message" style="color:#727272;margin-bottom:20px"></div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-ghost" onclick="cancelDelete()">ביטול</button>
        <button class="btn" style="background:#cd3468;color:#fff" onclick="confirmDelete()">מחק</button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write static/style.css**

```css
/* ── Reset & Base ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Heebo', sans-serif;
  background: #f2f4f6;
  color: #0a0a0a;
  direction: rtl;
  font-size: 14px;
  min-height: 100vh;
}

/* ── Header ── */
.app-header {
  background: #fff;
  border-bottom: 3px solid #1594a0;
  padding: 0 28px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.header-brand { display: flex; align-items: center; gap: 12px; }
.header-logo {
  width: 38px; height: 38px; background: #1594a0;
  border-radius: 8px; display: flex; align-items: center;
  justify-content: center; color: #fff; font-weight: 800; font-size: 18px;
  flex-shrink: 0;
}
.header-title  { font-size: 18px; font-weight: 700; }
.header-subtitle { font-size: 12px; color: #727272; margin-top: 1px; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.year-select {
  border: 1.5px solid #d1d1d1; border-radius: 8px; padding: 6px 12px;
  font-family: 'Heebo', sans-serif; font-size: 14px; font-weight: 600;
  background: #fff; color: #0a0a0a; cursor: pointer; outline: none;
}
.year-select:focus { border-color: #1594a0; }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 8px; font-size: 13px;
  font-family: 'Heebo', sans-serif; font-weight: 500; cursor: pointer;
  border: none; transition: all 0.15s; line-height: 1;
}
.btn-primary  { background: #1594a0; color: #fff; }
.btn-primary:hover { background: #117a84; }
.btn-outline  { background: #fff; color: #1594a0; border: 1.5px solid #1594a0; }
.btn-outline:hover { background: #f6fafd; }
.btn-ghost    { background: transparent; color: #727272; border: 1.5px solid #e2e2e2; }
.btn-ghost:hover { background: #f0f0f0; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.link-btn {
  background: none; border: none; color: #1594a0; font-size: 11px;
  cursor: pointer; text-decoration: underline; font-family: 'Heebo', sans-serif;
  padding: 0; margin-right: 6px;
}

/* ── Page Layout ── */
.page { max-width: 1280px; margin: 0 auto; padding: 24px 28px 48px; }

/* ── Section Title ── */
.section-title {
  font-size: 15px; font-weight: 700; margin-bottom: 14px;
  display: flex; align-items: center; gap: 8px;
}
.section-title::before {
  content: ''; width: 4px; height: 18px;
  background: #1594a0; border-radius: 2px; display: inline-block;
}

/* ── KPI Grid ── */
.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; margin-bottom: 24px;
}
.kpi-card {
  background: #fff; border-radius: 12px; padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  border-right: 4px solid transparent; transition: box-shadow 0.15s;
}
.kpi-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); }
.kpi-card.teal  { border-right-color: #1594a0; }
.kpi-card.pink  { border-right-color: #cd3468; }
.kpi-card.green { border-right-color: #2bac76; }
.kpi-card.amber { border-right-color: #e08c1a; }
.kpi-label { font-size: 11px; color: #727272; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
.kpi-value { font-size: 24px; font-weight: 800; line-height: 1.1; }
.kpi-value small { font-size: 13px; font-weight: 500; color: #727272; margin-right: 3px; }
.kpi-sub  { font-size: 11px; color: #8a8a8a; margin-top: 5px; }
.kpi-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-top: 5px; }
.badge-green { background: #e6f7f1; color: #1a8a58; }
.badge-amber { background: #fff3e0; color: #b86d00; }
.badge-red   { background: #fce8ee; color: #a0204a; }
.util-bar-wrap { margin-top: 6px; background: #f0f0f0; border-radius: 4px; height: 5px; }
.util-bar { height: 5px; border-radius: 4px; background: linear-gradient(90deg, #1594a0, #2bbb9a); transition: width 0.4s; }

/* ── Charts ── */
.charts-row {
  display: grid; grid-template-columns: 2fr 1fr;
  gap: 14px; margin-bottom: 24px;
}
.chart-card {
  background: #fff; border-radius: 12px; padding: 20px 22px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07);
}
.chart-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 16px; gap: 12px;
}
.chart-title  { font-size: 14px; font-weight: 700; }
.chart-legend { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.legend-item  { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #4e4e4e; }
.legend-dot   { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.view-toggle  { display: flex; gap: 3px; background: #f0f0f0; border-radius: 8px; padding: 3px; }
.view-toggle-btn {
  padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
  cursor: pointer; border: none; background: transparent; color: #727272;
  font-family: 'Heebo', sans-serif; transition: all 0.15s; white-space: nowrap;
}
.view-toggle-btn.active { background: #fff; color: #1594a0; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

/* ── Reserves ── */
.reserves-row {
  display: flex; flex-wrap: wrap; gap: 14px;
  margin-bottom: 24px; align-items: stretch;
}
.reserve-card {
  background: #fff; border-radius: 12px; padding: 16px 18px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.07); border-top: 3px solid #cd3468;
  min-width: 200px; flex: 1; position: relative;
}
.reserve-card.add-card {
  border: 2px dashed #d1d1d1; background: transparent; display: flex;
  align-items: center; justify-content: center;
  cursor: pointer; color: #8a8a8a; font-size: 13px; gap: 6px;
  box-shadow: none; border-top: none; min-height: 90px;
}
.reserve-card.add-card:hover { border-color: #1594a0; color: #1594a0; }
.reserve-name   { font-size: 12px; font-weight: 600; color: #727272; margin-bottom: 4px; }
.reserve-amount { font-size: 20px; font-weight: 800; color: #cd3468; }
.reserve-desc   { font-size: 11px; color: #8a8a8a; margin-top: 4px; }
.reserve-actions { position: absolute; top: 10px; left: 12px; display: flex; gap: 4px; }

/* ── Journal ── */
.journal-card { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); overflow: hidden; }
.journal-header {
  padding: 14px 20px; border-bottom: 1px solid #f0f0f0;
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 10px;
}
.month-carousel { display: flex; align-items: center; gap: 4px; }
.carousel-arrow {
  width: 28px; height: 28px; border-radius: 6px; border: 1.5px solid #e2e2e2;
  background: #fff; cursor: pointer; display: flex; align-items: center;
  justify-content: center; font-size: 14px; color: #4e4e4e; flex-shrink: 0;
}
.carousel-arrow:hover { border-color: #1594a0; color: #1594a0; }
.month-pills {
  display: flex; gap: 4px; overflow-x: hidden;
  max-width: 480px;
}
.month-pill {
  padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
  cursor: pointer; color: #4e4e4e; white-space: nowrap; background: transparent;
  border: 1.5px solid transparent; flex-shrink: 0; transition: all 0.12s;
}
.month-pill.active { background: #1594a0; color: #fff; }
.month-pill:hover:not(.active) { background: #f0f0f0; }
.month-pill.all { border-color: #d1d1d1; }
.month-pill.all:hover { border-color: #1594a0; color: #1594a0; }

.journal-filters {
  padding: 10px 20px; background: #f6fafd; border-bottom: 1px solid #e8e8e8;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
.filter-label  { font-size: 11px; color: #727272; font-weight: 500; }
.filter-select {
  border: 1.5px solid #e2e2e2; border-radius: 7px; padding: 5px 10px;
  font-family: 'Heebo', sans-serif; font-size: 12px; background: #fff;
  color: #0a0a0a; outline: none; cursor: pointer;
}
.filter-select:focus { border-color: #1594a0; }

.journal-table { width: 100%; border-collapse: collapse; }
.journal-table th {
  padding: 10px 16px; font-size: 11px; font-weight: 600; color: #727272;
  text-align: right; letter-spacing: 0.03em; background: #f6fafd;
  border-bottom: 1px solid #e8e8e8; text-transform: uppercase;
}
.journal-table td {
  padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}
.journal-table tr:last-child td { border-bottom: none; }
.journal-table tr:hover td { background: #f6fafd; }
.journal-table .confirm-row td { background: #fce8ee; }

.amount-cell   { font-weight: 700; font-size: 14px; direction: ltr; text-align: left; white-space: nowrap; }
.supplier-dot  { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-left: 6px; }
.status-badge  { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.row-actions   { display: flex; gap: 6px; }
.action-btn {
  width: 28px; height: 28px; border-radius: 5px; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 13px; background: #f0f0f0; color: #4e4e4e;
}
.action-btn:hover { background: #e2e2e2; }
.action-btn.del:hover { background: #fce8ee; color: #cd3468; }

.journal-footer {
  padding: 12px 20px; border-top: 1px solid #f0f0f0;
  display: flex; justify-content: space-between; align-items: center;
  background: #f6fafd;
}
.journal-footer-total strong { color: #cd3468; font-size: 16px; }

/* ── Modals ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 20px;
}
.modal-overlay.hidden { display: none; }
.modal {
  background: #fff; border-radius: 14px; width: 100%; max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden;
}
.modal-sm { max-width: 360px; }
.modal-xs { max-width: 300px; }
.settings-panel {
  background: #fff; border-radius: 14px; width: 100%; max-width: 540px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25); overflow: hidden; max-height: 90vh;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #f0f0f0; font-weight: 700; font-size: 15px;
}
.modal-close {
  background: none; border: none; font-size: 18px; cursor: pointer;
  color: #727272; line-height: 1; padding: 0;
}
.modal-close:hover { color: #cd3468; }
.modal-body { padding: 20px; overflow-y: auto; }
.modal-footer {
  padding: 14px 20px; border-top: 1px solid #f0f0f0;
  display: flex; justify-content: flex-start; gap: 10px;
}

/* ── Forms ── */
.form-row   { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.form-row label { font-size: 12px; font-weight: 600; color: #4e4e4e; display: flex; align-items: center; }
.form-input {
  border: 1.5px solid #e2e2e2; border-radius: 8px; padding: 8px 12px;
  font-family: 'Heebo', sans-serif; font-size: 13px; background: #fff;
  color: #0a0a0a; outline: none; width: 100%; direction: rtl;
}
.form-input:focus { border-color: #1594a0; }
.add-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
.add-row .form-input { flex: 1; }

/* ── Manage lists (suppliers/statuses) ── */
.manage-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 8px; margin-bottom: 4px;
  background: #f6fafd; font-size: 13px;
}
.manage-item:hover { background: #eef6f8; }
.manage-item-actions { display: flex; gap: 6px; }
.settings-section-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: #4e4e4e; }
.year-manage-item {
  display: flex; align-items: center; gap: 10px; padding: 10px;
  border-radius: 8px; background: #f6fafd; margin-bottom: 6px; font-size: 13px;
}
.year-manage-item strong { min-width: 90px; }
.year-manage-item .form-input { padding: 4px 8px; font-size: 12px; }

/* ── Utilities ── */
.hidden { display: none !important; }
.mb-24  { margin-bottom: 24px; }

/* ── Print ── */
@media print {
  .no-print { display: none !important; }
  .app-header { position: static; box-shadow: none; }
  body { background: #fff; }
  .page { padding: 0; }
  .chart-card, .journal-card, .kpi-card, .reserve-card { box-shadow: none; border: 1px solid #e2e2e2; }
  .journal-table td, .journal-table th { padding: 8px 10px; }
  .journal-table .action-btn { display: none; }
}
```

- [ ] **Step 3: Verify static files are served**

Start Flask: `python app.py`
Open http://localhost:5000 — page should load (empty, no data, but no 404s).
Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add static/
git commit -m "feat: HTML skeleton and full CSS"
```

---

## Task 8: app.js — Bootstrap, Data Loading, Year Selector, KPI Cards

**Files:**
- Create: `static/app.js`

- [ ] **Step 1: Write static/app.js (Part 1: state, bootstrap, data load, KPIs)**

```js
// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const APP = {
  raw:    null,          // full data from /api/data
  year:   null,          // selected year string e.g. '2025/2026'
  month:  null,          // { year, month } or null for 'all'
  filter: { supplier: '', status: '' },
  charts: { bar: null, pie: null },
  colors: {},            // supplierName -> hex color
  pendingDelete: null,   // { fn } waiting for confirm
};

const PALETTE = [
  '#1594a0','#cd3468','#e08c1a','#2bac76',
  '#7c5cbf','#e85d04','#3a86ff','#8ac926',
];

const HEB_MONTHS = {
  1:'ינו׳',2:'פבר׳',3:'מרצ׳',4:'אפר׳',5:'מאי',6:'יונ׳',
  7:'יול׳',8:'אוג׳',9:'ספט׳',10:'אוק׳',11:'נוב׳',12:'דצמ׳',
};

// ═══════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

async function loadData() {
  const res = await fetch('/api/data');
  APP.raw = await res.json();
  assignColors();
  initYearSelector();
  render();
}

function assignColors() {
  APP.colors = {};
  APP.raw.suppliers.forEach((s, i) => {
    APP.colors[s['שם']] = PALETTE[i % PALETTE.length];
  });
}

// ═══════════════════════════════════════════════════════
// YEAR SELECTOR
// ═══════════════════════════════════════════════════════
function initYearSelector() {
  const sel = document.getElementById('year-select');
  sel.innerHTML = '';

  const years = APP.raw.budget.map(r => r['שנה']).sort().reverse();
  years.forEach(y => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = y;
    sel.appendChild(opt);
  });

  // Auto-select the current academic year
  const now = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const currentAcademic = nowM >= 9
    ? `${nowY}/${nowY + 1}`
    : `${nowY - 1}/${nowY}`;

  APP.year = years.includes(currentAcademic) ? currentAcademic : (years[0] || '');
  sel.value = APP.year;

  sel.addEventListener('change', () => {
    APP.year = sel.value;
    APP.month = null;
    render();
  });
}

// ═══════════════════════════════════════════════════════
// RENDER ORCHESTRATOR
// ═══════════════════════════════════════════════════════
function render() {
  renderKPIs();
  renderCharts();
  renderReserves();
  renderCarousel();
  renderJournal();
  renderFilterSelects();
}

// ═══════════════════════════════════════════════════════
// KPI CALCULATIONS
// ═══════════════════════════════════════════════════════
function computeKPIs() {
  const yearCfg  = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const opening  = parseFloat(yearCfg['תקציב_פתיחה']) || 0;
  const endMonth = parseInt(yearCfg['חודש_סיום'])     || 8;

  const txns       = APP.raw.transactions.filter(r => r['שנה'] === APP.year);
  const totalSpent = txns.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);

  const rsvs          = APP.raw.reserves.filter(r => r['שנה'] === APP.year);
  const totalReserved = rsvs.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);

  const currentBalance   = opening - totalSpent;
  const operativeBalance = currentBalance - totalReserved;
  const monthsLeft       = calcMonthsLeft(APP.year, endMonth);
  const monthlyAllowed   = monthsLeft > 0 ? operativeBalance / monthsLeft : 0;
  const utilizationPct   = opening > 0 ? (totalSpent / opening) * 100 : 0;

  return { opening, totalSpent, currentBalance, totalReserved,
           operativeBalance, monthsLeft, monthlyAllowed, utilizationPct, endMonth };
}

function calcMonthsLeft(yearStr, endMonth) {
  const [, endYearStr] = yearStr.split('/');
  const endYear = parseInt(endYearStr);
  const now = new Date();
  const diff = (endYear - now.getFullYear()) * 12 + (endMonth - (now.getMonth() + 1));
  return Math.max(0, diff);
}

function fmt(n) {
  return '₪' + Math.round(n).toLocaleString('he-IL');
}

// ═══════════════════════════════════════════════════════
// KPI RENDER
// ═══════════════════════════════════════════════════════
function renderKPIs() {
  const k = computeKPIs();
  const grid = document.getElementById('kpi-grid');

  const badgePct = k.utilizationPct < 50
    ? '<span class="kpi-badge badge-green">בטווח יעד</span>'
    : k.utilizationPct < 80
    ? '<span class="kpi-badge badge-amber">שים לב</span>'
    : '<span class="kpi-badge badge-red">חריגה</span>';

  const balanceBadge = k.currentBalance >= 0
    ? '<span class="kpi-badge badge-green">✓ תקין</span>'
    : '<span class="kpi-badge badge-red">חריגה!</span>';

  grid.innerHTML = `
    <div class="kpi-card teal">
      <div class="kpi-label">תקציב שנתי</div>
      <div class="kpi-value">${fmt(k.opening)}</div>
      <div class="kpi-sub">שנת ${APP.year}</div>
    </div>
    <div class="kpi-card pink">
      <div class="kpi-label">הוצאות עד היום</div>
      <div class="kpi-value">${fmt(k.totalSpent)}</div>
      <div class="util-bar-wrap"><div class="util-bar" style="width:${Math.min(100,k.utilizationPct).toFixed(1)}%"></div></div>
      <div class="kpi-sub">${k.utilizationPct.toFixed(1)}% מהתקציב</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">יתרה נוכחית</div>
      <div class="kpi-value">${fmt(k.currentBalance)}</div>
      ${balanceBadge}
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">סכום שמור</div>
      <div class="kpi-value">${fmt(k.totalReserved)}</div>
      <div class="kpi-sub">${APP.raw.reserves.filter(r=>r['שנה']===APP.year).length} פריטים</div>
    </div>
    <div class="kpi-card teal">
      <div class="kpi-label">יתרה תפעולית</div>
      <div class="kpi-value">${fmt(k.operativeBalance)}</div>
      <div class="kpi-sub">לאחר הפחתת שמורות</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-label">חודשים שנותרו</div>
      <div class="kpi-value">${k.monthsLeft}</div>
      <div class="kpi-sub">עד ${HEB_MONTHS[k.endMonth]}</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">תקציב חודשי מותר</div>
      <div class="kpi-value">${fmt(k.monthlyAllowed)}</div>
      <div class="kpi-sub">ממוצע • יתרה ÷ חודשים</div>
    </div>
    <div class="kpi-card pink">
      <div class="kpi-label">אחוז ניצול</div>
      <div class="kpi-value">${k.utilizationPct.toFixed(1)}%</div>
      ${badgePct}
    </div>
  `;
}
```

- [ ] **Step 2: Verify in browser**

Run `python app.py`. With real credentials + a seeded sheet the KPI cards should appear. Without credentials, confirm the page loads and shows an empty state without crashing.

- [ ] **Step 3: Commit**

```bash
git add static/app.js
git commit -m "feat: data loading, year selector, KPI cards"
```

---

## Task 9: app.js — Charts

**Files:**
- Modify: `static/app.js` (append)

- [ ] **Step 1: Append chart helpers and render functions to app.js**

```js
// ═══════════════════════════════════════════════════════
// CHART HELPERS
// ═══════════════════════════════════════════════════════
function getYearMonths(yearStr, endMonth) {
  const [startYearStr, endYearStr] = yearStr.split('/');
  let y = parseInt(startYearStr), m = 9; // academic year starts September
  const endY = parseInt(endYearStr);
  const months = [];
  while (true) {
    months.push({ year: y, month: m });
    if (y === endY && m === endMonth) break;
    m++; if (m > 12) { m = 1; y++; }
    if (y > endY || (y === endY && m > endMonth)) break;
  }
  return months;
}

function buildChartData() {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);
  const txns     = APP.raw.transactions.filter(r => r['שנה'] === APP.year);
  const active   = APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE').map(s => s['שם']);

  const labels   = months.map(({ year, month }) => HEB_MONTHS[month]);
  const datasets = active.map(sup => ({
    label:           sup,
    backgroundColor: APP.colors[sup] || '#ccc',
    borderRadius:    4,
    data: months.map(({ year, month }) =>
      txns
        .filter(r => {
          const [, m, y] = r['תאריך'].split('/').map(Number);
          return r['ספק'] === sup && m === month && y === year;
        })
        .reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0)
    ),
  }));

  const totals = active.map(sup =>
    txns.filter(r => r['ספק'] === sup).reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0)
  );

  return { labels, datasets, active, totals };
}

// ═══════════════════════════════════════════════════════
// RENDER CHARTS
// ═══════════════════════════════════════════════════════
function renderCharts() {
  const { labels, datasets, active, totals } = buildChartData();

  // Legend
  document.getElementById('bar-legend').innerHTML = active.map(sup =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${APP.colors[sup]||'#ccc'}"></div>
       ${sup}
     </div>`
  ).join('');

  // Bar chart
  const barCtx = document.getElementById('bar-chart').getContext('2d');
  if (APP.charts.bar) APP.charts.bar.destroy();
  APP.charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { family: 'Heebo', size: 11 } } },
        y: { stacked: true, grid: { color: '#f0f0f0' }, ticks: {
          font: { family: 'Heebo', size: 10 },
          callback: v => '₪' + v.toLocaleString(),
        }},
      },
    },
  });

  // Pie chart
  const total   = totals.reduce((a, b) => a + b, 0);
  const pieCtx  = document.getElementById('pie-chart').getContext('2d');
  if (APP.charts.pie) APP.charts.pie.destroy();
  APP.charts.pie = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: active,
      datasets: [{
        data:            totals,
        backgroundColor: active.map(s => APP.colors[s] || '#ccc'),
        borderWidth: 2, borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Heebo', size: 11 }, padding: 12 } },
        tooltip: {
          rtl: true,
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0.0';
              return `  ${ctx.label}: ₪${Math.round(ctx.parsed).toLocaleString()} (${pct}%)`;
            },
          },
          bodyFont: { family: 'Heebo', size: 12 },
          padding: 10, cornerRadius: 8,
        },
      },
    },
  });
}

function setBarMode(mode) {
  const stacked = mode === 'stacked';
  APP.charts.bar.options.scales.x.stacked = stacked;
  APP.charts.bar.options.scales.y.stacked = stacked;
  APP.charts.bar.update();
  document.getElementById('btn-stacked').classList.toggle('active', stacked);
  document.getElementById('btn-grouped').classList.toggle('active', !stacked);
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: monthly bar chart (stacked/grouped toggle) + supplier doughnut"
```

---

## Task 10: app.js — Reserves Section

**Files:**
- Modify: `static/app.js` (append)

- [ ] **Step 1: Append reserves render + CRUD to app.js**

```js
// ═══════════════════════════════════════════════════════
// RESERVES
// ═══════════════════════════════════════════════════════
const RESERVE_COLORS = ['#cd3468','#e08c1a','#2bac76','#7c5cbf','#1594a0'];

function renderReserves() {
  const container = document.getElementById('reserves-container');
  const reserves  = APP.raw.reserves.filter(r => r['שנה'] === APP.year);

  const cards = reserves.map((r, i) => {
    const color = RESERVE_COLORS[i % RESERVE_COLORS.length];
    return `
      <div class="reserve-card" style="border-top-color:${color}">
        <div class="reserve-actions no-print">
          <button class="action-btn" onclick="editReserve('${r.id}')">✎</button>
          <button class="action-btn del" onclick="deleteReserve('${r.id}','${r['שם']}')">✕</button>
        </div>
        <div class="reserve-name">${r['שם']}</div>
        <div class="reserve-amount" style="color:${color}">₪${parseFloat(r['סכום']).toLocaleString()}</div>
        <div class="reserve-desc">${r['תיאור'] || ''}</div>
      </div>`;
  }).join('');

  container.innerHTML = cards + `
    <div class="reserve-card add-card no-print" onclick="openReserveModal(null)">
      <span style="font-size:20px">＋</span> הוסף שמור
    </div>`;
}

// Reserve modal reuses the transaction modal overlay with a separate form
// injected dynamically (avoids adding another modal to the HTML)
let _reserveEditId = null;

function openReserveModal(id) {
  _reserveEditId = id;
  const r = id ? APP.raw.reserves.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = id ? 'עריכת שמור' : 'הוספת סכום שמור';
  document.getElementById('modal-overlay').classList.remove('hidden');

  // Temporarily swap modal body content for reserve form
  document.querySelector('.modal-body').innerHTML = `
    <div class="form-row">
      <label>שם</label>
      <input type="text" id="rsv-name" class="form-input" value="${r ? r['שם'] : ''}">
    </div>
    <div class="form-row">
      <label>סכום (₪)</label>
      <input type="number" id="rsv-amount" class="form-input" min="0" step="0.01" value="${r ? r['סכום'] : ''}">
    </div>
    <div class="form-row">
      <label>תיאור</label>
      <input type="text" id="rsv-desc" class="form-input" value="${r ? r['תיאור'] : ''}">
    </div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeTransactionModal()">ביטול</button>
    <button class="btn btn-primary" onclick="saveReserve()">שמור</button>
  `;
}

async function saveReserve() {
  const name   = document.getElementById('rsv-name').value.trim();
  const amount = document.getElementById('rsv-amount').value;
  const desc   = document.getElementById('rsv-desc').value.trim();
  if (!name || !amount) return;

  const row = { id: _reserveEditId || String(Date.now()), שנה: APP.year, שם: name, סכום: amount, תיאור: desc };
  const action = _reserveEditId ? 'update' : 'create';

  await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action, row }) });

  if (action === 'create') {
    APP.raw.reserves.push(row);
  } else {
    const idx = APP.raw.reserves.findIndex(x => x.id === row.id);
    if (idx >= 0) APP.raw.reserves[idx] = row;
  }

  closeTransactionModal();
  renderReserves();
  renderKPIs();
}

function editReserve(id) { openReserveModal(id); }

function deleteReserve(id, name) {
  APP.pendingDelete = async () => {
    await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
    APP.raw.reserves = APP.raw.reserves.filter(r => r.id !== id);
    renderReserves();
    renderKPIs();
  };
  document.getElementById('confirm-message').textContent = `למחוק את "${name}"?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: reserves section render + add/edit/delete"
```

---

## Task 11: app.js — Transaction Journal (Carousel + Filters + Table)

**Files:**
- Modify: `static/app.js` (append)

- [ ] **Step 1: Append journal render to app.js**

```js
// ═══════════════════════════════════════════════════════
// JOURNAL — CAROUSEL
// ═══════════════════════════════════════════════════════
let _carouselOffset = 0;
const PILLS_VISIBLE  = 6;

function renderCarousel() {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);

  // Auto-focus current month on first render
  if (APP.month === null) {
    const now = new Date();
    const cur = months.find(m => m.month === now.getMonth() + 1 && m.year === now.getFullYear());
    APP.month = cur || null;
    // Set carousel offset so current month is visible
    const idx = cur ? months.indexOf(cur) : 0;
    _carouselOffset = Math.max(0, idx - Math.floor(PILLS_VISIBLE / 2));
  }

  const pills = document.getElementById('month-pills');
  const slice = months.slice(_carouselOffset, _carouselOffset + PILLS_VISIBLE);

  const allActive = APP.month === null;
  pills.innerHTML =
    `<div class="month-pill all ${allActive ? 'active' : ''}" onclick="selectMonth(null)">הכל</div>` +
    slice.map(({ year, month }) => {
      const active = APP.month && APP.month.month === month && APP.month.year === year;
      return `<div class="month-pill ${active ? 'active' : ''}"
        onclick="selectMonth(${month},${year})">${HEB_MONTHS[month]}</div>`;
    }).join('');
}

function scrollCarousel(dir) {
  const cfg      = APP.raw.budget.find(r => r['שנה'] === APP.year) || {};
  const endMonth = parseInt(cfg['חודש_סיום']) || 8;
  const months   = getYearMonths(APP.year, endMonth);
  _carouselOffset = Math.max(0, Math.min(_carouselOffset + dir, months.length - PILLS_VISIBLE));
  renderCarousel();
}

function selectMonth(month, year) {
  APP.month = month === null ? null : { month, year };
  renderCarousel();
  renderJournal();
}

// ═══════════════════════════════════════════════════════
// JOURNAL — FILTERS
// ═══════════════════════════════════════════════════════
function renderFilterSelects() {
  const supSel = document.getElementById('filter-supplier');
  const stSel  = document.getElementById('filter-status');

  supSel.innerHTML = '<option value="">כל הספקים</option>' +
    APP.raw.suppliers.filter(s => s['פעיל'] === 'TRUE')
      .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  stSel.innerHTML = '<option value="">כל הסטטוסים</option>' +
    APP.raw.statuses.map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  supSel.value = APP.filter.supplier;
  stSel.value  = APP.filter.status;
}

function applyFilters() {
  APP.filter.supplier = document.getElementById('filter-supplier').value;
  APP.filter.status   = document.getElementById('filter-status').value;
  renderJournal();
}

function clearFilters() {
  APP.filter = { supplier: '', status: '' };
  renderFilterSelects();
  renderJournal();
}

// ═══════════════════════════════════════════════════════
// JOURNAL — TABLE
// ═══════════════════════════════════════════════════════
function getFilteredTransactions() {
  let rows = APP.raw.transactions.filter(r => r['שנה'] === APP.year);

  if (APP.month) {
    rows = rows.filter(r => {
      const parts = r['תאריך'].split('/').map(Number);
      return parts[1] === APP.month.month && parts[2] === APP.month.year;
    });
  }
  if (APP.filter.supplier) rows = rows.filter(r => r['ספק'] === APP.filter.supplier);
  if (APP.filter.status)   rows = rows.filter(r => r['סטטוס'] === APP.filter.status);

  return rows.sort((a, b) => {
    const parse = s => { const [d,m,y] = s.split('/').map(Number); return new Date(y,m-1,d); };
    return parse(b['תאריך']) - parse(a['תאריך']);
  });
}

function renderJournal() {
  const rows  = getFilteredTransactions();
  const total = rows.reduce((s, r) => s + (parseFloat(r['סכום']) || 0), 0);
  const tbody = document.getElementById('journal-tbody');

  tbody.innerHTML = rows.map(r => {
    const color  = APP.colors[r['ספק']] || '#ccc';
    const status = APP.raw.statuses.find(s => s['שם'] === r['סטטוס']);
    const badgeColor = status ? status['צבע'] : '#727272';
    const badgeBg    = badgeColor + '22';
    return `<tr>
      <td>${r['תאריך']}</td>
      <td><span class="supplier-dot" style="background:${color}"></span>${r['ספק']}</td>
      <td style="color:#727272;font-size:12px">${r['מס_חשבונית'] || '—'}</td>
      <td style="color:#727272">${r['תיאור'] || ''}</td>
      <td class="amount-cell">₪${parseFloat(r['סכום']).toLocaleString()}</td>
      <td><span class="status-badge" style="background:${badgeBg};color:${badgeColor}">${r['סטטוס']}</span></td>
      <td class="no-print"><div class="row-actions">
        <button class="action-btn" onclick="openTransactionModal('${r.id}')">✎</button>
        <button class="action-btn del" onclick="deleteTransaction('${r.id}','${r['ספק']}','${r['תאריך']}')">✕</button>
      </div></td>
    </tr>`;
  }).join('');

  const period = APP.month
    ? `${HEB_MONTHS[APP.month.month]} ${APP.month.year}`
    : APP.year;
  document.getElementById('journal-count').textContent = `${rows.length} תנועות | ${period}`;
  document.getElementById('journal-total').textContent = `₪${Math.round(total).toLocaleString()}`;
}

function printJournal() {
  window.print();
}

function deleteTransaction(id, supplier, date) {
  APP.pendingDelete = async () => {
    await fetch('/api/transaction', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
    APP.raw.transactions = APP.raw.transactions.filter(r => r.id !== id);
    render();
  };
  document.getElementById('confirm-message').textContent = `למחוק תנועה של ${supplier} מתאריך ${date}?`;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
// DELETE CONFIRM
// ═══════════════════════════════════════════════════════
function confirmDelete() {
  if (APP.pendingDelete) APP.pendingDelete();
  APP.pendingDelete = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}

function cancelDelete() {
  APP.pendingDelete = null;
  document.getElementById('confirm-overlay').classList.add('hidden');
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: journal carousel, filters, table, delete confirm"
```

---

## Task 12: app.js — Transaction Modal (Add / Edit)

**Files:**
- Modify: `static/app.js` (append)

- [ ] **Step 1: Append transaction modal functions to app.js**

```js
// ═══════════════════════════════════════════════════════
// TRANSACTION MODAL
// ═══════════════════════════════════════════════════════
function _restoreTransactionForm() {
  document.querySelector('.modal-body').innerHTML = `
    <input type="hidden" id="txn-id">
    <div class="form-row">
      <label>תאריך</label>
      <input type="date" id="txn-date" class="form-input">
    </div>
    <div class="form-row">
      <label>ספק <button class="link-btn no-print" onclick="openManageSuppliers()">נהל ספקים</button></label>
      <select id="txn-supplier" class="form-input"></select>
    </div>
    <div class="form-row">
      <label>מס׳ חשבונית</label>
      <input type="text" id="txn-invoice" class="form-input" placeholder="מספר חשבונית">
    </div>
    <div class="form-row">
      <label>תיאור</label>
      <input type="text" id="txn-description" class="form-input" placeholder="תיאור (אופציונלי)">
    </div>
    <div class="form-row">
      <label>סכום (₪)</label>
      <input type="number" id="txn-amount" class="form-input" min="0" step="0.01">
    </div>
    <div class="form-row">
      <label>סטטוס <button class="link-btn no-print" onclick="openManageStatuses()">נהל סטטוסים</button></label>
      <select id="txn-status" class="form-input"></select>
    </div>
  `;
  document.querySelector('.modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeTransactionModal()">ביטול</button>
    <button class="btn btn-primary" onclick="saveTransaction()">שמור</button>
  `;
}

function openTransactionModal(id) {
  _restoreTransactionForm();

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  // Populate supplier dropdown
  const supSel = document.getElementById('txn-supplier');
  supSel.innerHTML = APP.raw.suppliers
    .filter(s => s['פעיל'] === 'TRUE')
    .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  // Populate status dropdown
  const stSel = document.getElementById('txn-status');
  stSel.innerHTML = APP.raw.statuses
    .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');

  if (id) {
    const r = APP.raw.transactions.find(t => t.id === id);
    document.getElementById('modal-title').textContent = 'עריכת תנועה';
    document.getElementById('txn-id').value          = r.id;
    document.getElementById('txn-date').value        = isoDate(r['תאריך']);
    document.getElementById('txn-supplier').value    = r['ספק'];
    document.getElementById('txn-invoice').value     = r['מס_חשבונית'];
    document.getElementById('txn-description').value = r['תיאור'];
    document.getElementById('txn-amount').value      = r['סכום'];
    document.getElementById('txn-status').value      = r['סטטוס'];
  } else {
    document.getElementById('modal-title').textContent = 'הוספת תנועה';
    document.getElementById('txn-date').value = new Date().toISOString().slice(0,10);
  }
}

// Convert DD/MM/YYYY → YYYY-MM-DD for date input
function isoDate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Convert YYYY-MM-DD → DD/MM/YYYY for storage
function heDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function saveTransaction() {
  const id      = document.getElementById('txn-id').value;
  const dateVal = document.getElementById('txn-date').value;
  const amount  = document.getElementById('txn-amount').value;
  if (!dateVal || !amount) return;

  const row = {
    id:          id || String(Date.now()),
    שנה:         APP.year,
    תאריך:       heDate(dateVal),
    ספק:         document.getElementById('txn-supplier').value,
    מס_חשבונית: document.getElementById('txn-invoice').value.trim(),
    תיאור:       document.getElementById('txn-description').value.trim(),
    סכום:        amount,
    סטטוס:       document.getElementById('txn-status').value,
  };
  const action = id ? 'update' : 'create';

  await fetch('/api/transaction', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action, row }),
  });

  if (action === 'create') {
    APP.raw.transactions.push(row);
  } else {
    const idx = APP.raw.transactions.findIndex(t => t.id === row.id);
    if (idx >= 0) APP.raw.transactions[idx] = row;
  }

  closeTransactionModal();
  render();
}

function closeTransactionModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  _reserveEditId = null;
}

function closeModal(event) {
  if (event.target === document.getElementById('modal-overlay')) closeTransactionModal();
  if (event.target === document.getElementById('suppliers-modal')) closeManageSuppliers();
  if (event.target === document.getElementById('statuses-modal')) closeManageStatuses();
  if (event.target === document.getElementById('settings-overlay')) closeSettings();
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: transaction add/edit modal"
```

---

## Task 13: app.js — Manage Suppliers, Statuses & Settings Panel

**Files:**
- Modify: `static/app.js` (append)

- [ ] **Step 1: Append manage suppliers/statuses + settings to app.js**

```js
// ═══════════════════════════════════════════════════════
// MANAGE SUPPLIERS
// ═══════════════════════════════════════════════════════
function openManageSuppliers() {
  renderSuppliersList();
  document.getElementById('suppliers-modal').classList.remove('hidden');
}

function closeManageSuppliers() {
  document.getElementById('suppliers-modal').classList.add('hidden');
  renderFilterSelects();
  // Refresh supplier dropdown in transaction modal if open
  const supSel = document.getElementById('txn-supplier');
  if (supSel) {
    supSel.innerHTML = APP.raw.suppliers
      .filter(s => s['פעיל'] === 'TRUE')
      .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');
  }
}

function renderSuppliersList() {
  document.getElementById('suppliers-list').innerHTML =
    APP.raw.suppliers.map(s => `
      <div class="manage-item">
        <span>${s['שם']} ${s['פעיל'] === 'FALSE' ? '<em style="color:#8a8a8a;font-size:11px">(לא פעיל)</em>' : ''}</span>
        <div class="manage-item-actions">
          <button class="action-btn" onclick="toggleSupplierActive('${s.id}','${s['שם']}','${s['פעיל']}')" title="${s['פעיל']==='TRUE'?'הסתר':'הפעל'}">
            ${s['פעיל'] === 'TRUE' ? '○' : '●'}
          </button>
          <button class="action-btn del" onclick="deleteSupplier('${s.id}','${s['שם']}')">✕</button>
        </div>
      </div>`).join('');
}

async function addSupplier() {
  const name = document.getElementById('new-supplier-name').value.trim();
  if (!name) return;
  const row = { id: String(Date.now()), שם: name, פעיל: 'TRUE' };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'create', row }) });
  APP.raw.suppliers.push(row);
  assignColors();
  document.getElementById('new-supplier-name').value = '';
  renderSuppliersList();
}

async function toggleSupplierActive(id, name, current) {
  const newActive = current === 'TRUE' ? 'FALSE' : 'TRUE';
  const row = { id, שם: name, פעיל: newActive };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'update', row }) });
  const s = APP.raw.suppliers.find(x => x.id === id);
  if (s) s['פעיל'] = newActive;
  renderSuppliersList();
}

async function deleteSupplier(id, name) {
  if (!confirm(`למחוק את הספק "${name}"?`)) return;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'delete', id }) });
  APP.raw.suppliers = APP.raw.suppliers.filter(s => s.id !== id);
  assignColors();
  renderSuppliersList();
}

// ═══════════════════════════════════════════════════════
// MANAGE STATUSES
// ═══════════════════════════════════════════════════════
function openManageStatuses() {
  renderStatusesList();
  document.getElementById('statuses-modal').classList.remove('hidden');
}

function closeManageStatuses() {
  document.getElementById('statuses-modal').classList.add('hidden');
  renderFilterSelects();
  const stSel = document.getElementById('txn-status');
  if (stSel) {
    stSel.innerHTML = APP.raw.statuses
      .map(s => `<option value="${s['שם']}">${s['שם']}</option>`).join('');
  }
}

function renderStatusesList() {
  document.getElementById('statuses-list').innerHTML =
    APP.raw.statuses.map(s => `
      <div class="manage-item">
        <span>
          <span class="status-badge" style="background:${s['צבע']}22;color:${s['צבע']}">${s['שם']}</span>
        </span>
        <div class="manage-item-actions">
          <button class="action-btn del" onclick="deleteStatus('${s.id}','${s['שם']}')">✕</button>
        </div>
      </div>`).join('');
}

async function addStatus() {
  const name  = document.getElementById('new-status-name').value.trim();
  const color = document.getElementById('new-status-color').value;
  if (!name) return;
  const row = { id: String(Date.now()), שם: name, צבע: color };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'create', row }) });
  APP.raw.statuses.push(row);
  document.getElementById('new-status-name').value = '';
  renderStatusesList();
}

async function deleteStatus(id, name) {
  if (!confirm(`למחוק את הסטטוס "${name}"?`)) return;
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'delete', id }) });
  APP.raw.statuses = APP.raw.statuses.filter(s => s.id !== id);
  renderStatusesList();
}

// ═══════════════════════════════════════════════════════
// SETTINGS PANEL — YEAR MANAGEMENT
// ═══════════════════════════════════════════════════════
function openSettings() {
  renderYearsList();
  document.getElementById('settings-overlay').classList.remove('hidden');
}

function closeSettings(event) {
  if (event && event.target !== document.getElementById('settings-overlay') &&
      event.type === 'click') return;
  document.getElementById('settings-overlay').classList.add('hidden');
}

function renderYearsList() {
  document.getElementById('years-list').innerHTML =
    APP.raw.budget.map(r => `
      <div class="year-manage-item">
        <strong>${r['שנה']}</strong>
        <span style="font-size:11px;color:#727272">תקציב:</span>
        <input type="number" class="form-input" value="${r['תקציב_פתיחה']}"
          onchange="updateYear('${r['שנה']}',this.value,'${r['חודש_סיום']}')">
        <span style="font-size:11px;color:#727272">חודש סיום:</span>
        <input type="number" class="form-input" style="width:60px" min="1" max="12" value="${r['חודש_סיום']}"
          onchange="updateYear('${r['שנה']}','${r['תקציב_פתיחה']}',this.value)">
      </div>`).join('');
}

async function updateYear(yearStr, budget, endMonth) {
  const row = { שנה: yearStr, תקציב_פתיחה: budget, חודש_סיום: endMonth };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'update', row }) });
  const y = APP.raw.budget.find(r => r['שנה'] === yearStr);
  if (y) { y['תקציב_פתיחה'] = budget; y['חודש_סיום'] = endMonth; }
  renderKPIs();
}

async function addYear() {
  const yearStr  = document.getElementById('new-year-str').value.trim();
  const budget   = document.getElementById('new-year-budget').value;
  const endMonth = document.getElementById('new-year-endmonth').value || '8';
  if (!yearStr || !budget) return;

  const row = { שנה: yearStr, תקציב_פתיחה: budget, חודש_סיום: endMonth };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'create', row }) });

  APP.raw.budget.push(row);
  document.getElementById('new-year-str').value    = '';
  document.getElementById('new-year-budget').value = '';

  // Update year selector
  const sel = document.getElementById('year-select');
  const opt = document.createElement('option');
  opt.value = opt.textContent = yearStr;
  sel.appendChild(opt);

  renderYearsList();
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: manage suppliers/statuses modals + settings panel with year management"
```

---

## Task 14: Deployment Files + Final Checks

**Files:**
- Create: `Start Budget App.bat`
- Verify: `.gitignore` covers credentials.json

- [ ] **Step 1: Create Start Budget App.bat**

```bat
@echo off
title Budget App
cd /d "%~dp0"
echo Checking for updates...
git pull --quiet
echo Starting server...
python app.py
```

(The `%~dp0` resolves to the directory containing the bat file — so it works regardless of where the shortcut is placed.)

- [ ] **Step 2: Verify .gitignore**

Confirm `credentials.json` is in `.gitignore`. Run:

```bash
git status
```

`credentials.json` must NOT appear in untracked files. If it does, add it:

```bash
echo credentials.json >> .gitignore
git add .gitignore
```

- [ ] **Step 3: Run full test suite one last time**

```bash
pytest tests/ -v
```

All 11 tests must pass.

- [ ] **Step 4: Final commit**

```bash
git add Start\ Budget\ App.bat
git commit -m "feat: desktop launcher bat file"
```

- [ ] **Step 5: Push to private GitHub repo**

Create a private repo on GitHub (UI), then:

```bash
git remote add origin https://github.com/<your-username>/budget-mgmt.git
git branch -M main
git push -u origin main
```

- [ ] **Step 6: Google Cloud one-time setup (do once, outside of code)**

1. Go to https://console.cloud.google.com → New Project
2. Enable **Google Sheets API** (APIs & Services → Library)
3. Create a **Service Account** (IAM & Admin → Service Accounts → Create)
4. Create a JSON key for the service account → download as `credentials.json`
5. Place `credentials.json` in `C:\repos\budget-mgmt\` (not committed)
6. Create a new Google Sheet named `ניהול תקציב פרסום`
7. Share the sheet with the service account email (Editor)
8. Copy the sheet ID from its URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`) into `config.json`

- [ ] **Step 7: Smoke test end-to-end**

```bash
python app.py
```

Browser opens → KPI cards show zeros → Add a transaction → Verify it appears in the Google Sheet → Refresh the page → Transaction still visible.

---

## Notes for Future Sessions

- To add a new feature: edit `app.py` (backend) and/or `static/app.js` (frontend), push to GitHub. User gets it on next launch.
- Supplier colors are assigned by order in the `ספקים` sheet. Reordering suppliers changes colors.
- The `תנועות` sheet balance column from the original Excel is not used — balance is computed in JS from the opening budget minus all transactions.
- `credentials.json` must be manually copied to any new machine. It is never in git.
