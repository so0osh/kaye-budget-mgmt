# GitHub Pages + Google OAuth2 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Flask + Windows launcher with a fully static GitHub Pages app that calls the Google Sheets API directly via OAuth2.

**Architecture:** The existing SPA (`static/`) is kept intact. A new `static/sheets-api.js` replaces `sheets.py`, using `fetch()` against the Sheets REST API v4 with a GIS OAuth2 Bearer token. `app.js` is updated to call `sheets-api.js` functions instead of Flask endpoints. All Python files, launchers, and tests are deleted.

**Tech Stack:** Vanilla JS, Google Identity Services (GIS) CDN, Google Sheets API v4 REST, GitHub Pages.

**Design spec:** `docs/superpowers/specs/2026-05-18-github-pages-migration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `static/config.js` | SPREADSHEET_ID, OAUTH_CLIENT_ID, APP_VERSION constants |
| Create | `static/sheets-api.js` | GIS auth + all Sheets API operations + seedSheets |
| Modify | `static/index.html` | Add GIS + config.js + sheets-api.js script tags; fix asset paths; add sign-in overlay |
| Modify | `static/app.js` | Replace all `fetch('/api/...')` calls with sheets-api.js functions; update loadData |
| Delete | `app.py`, `sheets.py`, `launcher.py`, `launch.vbs`, `launch.bat` | Backend removed |
| Delete | `requirements.txt`, `config.template.json`, `tests/`, `.github/workflows/release-asset.yml` | No longer needed |
| Delete | `generate_icon.py`, `icon-params.md`, `icon.png`, `launch.ico`, `version.txt` | Launcher assets removed |
| Modify | `.gitignore` | Remove stale Python/credentials entries |
| Modify | `CLAUDE.md` | Reflect new architecture |
| Modify | `README.md` | New setup instructions |

---

## Task 1: Create `static/config.js`

**Files:**
- Create: `static/config.js`

- [ ] **Step 1: Create the file with placeholder values**

```javascript
const SPREADSHEET_ID  = 'YOUR_SPREADSHEET_ID_HERE';
const OAUTH_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const APP_VERSION     = 'v1.4.0';
```

- [ ] **Step 2: Commit**

```bash
git add static/config.js
git commit -m "feat: add config.js with spreadsheet ID, OAuth client ID, version"
```

---

## Task 2: Create `static/sheets-api.js` — Auth layer

**Files:**
- Create: `static/sheets-api.js`

This task creates the file with just the authentication plumbing. Sheets operations are added in Task 3.

- [ ] **Step 1: Create `static/sheets-api.js` with the GIS token client**

```javascript
// ═══════════════════════════════════════════════════════
// AUTH — Google Identity Services token model
// ═══════════════════════════════════════════════════════
let _tokenClient  = null;
let _resolveToken = null;

function initAuth() {
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: OAUTH_CLIENT_ID,
    scope:     'https://www.googleapis.com/auth/spreadsheets',
    callback:  (resp) => {
      if (resp.error) {
        console.error('GIS token error:', resp.error);
        if (_resolveToken) { _resolveToken(null); _resolveToken = null; }
        return;
      }
      const expiry = Date.now() + (resp.expires_in - 60) * 1000;
      sessionStorage.setItem('gis_token',  resp.access_token);
      sessionStorage.setItem('gis_expiry', String(expiry));
      if (_resolveToken) { _resolveToken(resp.access_token); _resolveToken = null; }
    },
  });
}

async function getToken() {
  const token  = sessionStorage.getItem('gis_token');
  const expiry = parseInt(sessionStorage.getItem('gis_expiry') || '0', 10);
  if (token && Date.now() < expiry) return token;

  return new Promise((resolve) => {
    _resolveToken = resolve;
    _tokenClient.requestAccessToken({ prompt: '' });
  });
}

function signIn() {
  return new Promise((resolve) => {
    _resolveToken = resolve;
    _tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

function signOut() {
  const token = sessionStorage.getItem('gis_token');
  if (token) google.accounts.oauth2.revoke(token, () => {});
  sessionStorage.removeItem('gis_token');
  sessionStorage.removeItem('gis_expiry');
}
```

- [ ] **Step 2: Commit**

```bash
git add static/sheets-api.js
git commit -m "feat: add sheets-api.js auth layer (GIS token client)"
```

---

## Task 3: Add Sheets operations to `static/sheets-api.js`

**Files:**
- Modify: `static/sheets-api.js`

- [ ] **Step 1: Append the constants block (ported from `sheets.py`)**

Add this to the bottom of `static/sheets-api.js`:

```javascript
// ═══════════════════════════════════════════════════════
// SHEET CONSTANTS (ported from sheets.py)
// ═══════════════════════════════════════════════════════
const SHEET_NAMES = {
  budget:       'תקציב',
  transactions: 'תנועות',
  suppliers:    'ספקים',
  statuses:     'סטטוסים',
  reserves:     'שמורות',
  departments:  'מחלקות',
};

const COLUMNS = {
  budget:       ['שנה', 'תקציב_פתיחה', 'חודש_סיום'],
  transactions: ['id', 'שנה', 'תאריך', 'ספק', 'מס_חשבונית', 'תיאור', 'סכום', 'סטטוס', 'מחלקה'],
  suppliers:    ['id', 'שם', 'פעיל', 'מחלקה'],
  statuses:     ['id', 'שם', 'צבע'],
  reserves:     ['id', 'שנה', 'שם', 'סכום', 'תיאור'],
  departments:  ['id', 'שם', 'ברירת_מחדל'],
};

const SEED_DATA = {
  budget:       [['2025/2026', '0', '8']],
  transactions: [],
  suppliers: [
    ['1000000001', 'גוגל',           'TRUE', ''],
    ['1000000002', 'פייסבוק',        'TRUE', ''],
    ['1000000003', 'אינטרנטיק',      'TRUE', ''],
    ['1000000004', 'נרשמים',         'TRUE', ''],
    ['1000000005', 'לימודים בישראל', 'TRUE', ''],
  ],
  statuses: [
    ['2000000001', 'שולם',         '#2bac76'],
    ['2000000002', 'ממתין לאישור', '#e08c1a'],
    ['2000000003', 'מאושר',        '#1594a0'],
    ['2000000004', 'בוטל',         '#cd3468'],
  ],
  reserves:    [],
  departments: [],
};

const _BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
const _sheetNumericIds = {};
```

- [ ] **Step 2: Append `readAllSheets`**

```javascript
// ═══════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════
async function readAllSheets() {
  const token  = await getToken();
  const ranges = Object.values(SHEET_NAMES).map(n => `${n}!A:Z`);
  const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const res    = await fetch(`${_BASE}/values:batchGet?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data   = await res.json();
  const result = {};
  const keys   = Object.keys(SHEET_NAMES);
  data.valueRanges.forEach((vr, i) => {
    const key    = keys[i];
    const values = vr.values || [];
    if (!values.length) { result[key] = []; return; }
    const headers = values[0];
    result[key] = values.slice(1).map(row => {
      const padded = [...row, ...Array(Math.max(0, headers.length - row.length)).fill('')];
      return Object.fromEntries(headers.map((h, j) => [h, padded[j]]));
    });
  });
  return result;
}
```

- [ ] **Step 3: Append `appendRow`**

```javascript
// ═══════════════════════════════════════════════════════
// WRITE
// ═══════════════════════════════════════════════════════
async function appendRow(sheetKey, values) {
  const token = await getToken();
  const name  = SHEET_NAMES[sheetKey];
  await fetch(
    `${_BASE}/values/${encodeURIComponent(name)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [values] }),
    }
  );
}
```

- [ ] **Step 4: Append `updateRowById`**

```javascript
async function updateRowById(sheetKey, rowId, values) {
  const token   = await getToken();
  const name    = SHEET_NAMES[sheetKey];
  const colRes  = await fetch(`${_BASE}/values/${encodeURIComponent(name)}!A:A`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const col      = (await colRes.json()).values || [];
  const rowIndex = col.findIndex(cell => cell[0] === String(rowId));
  if (rowIndex < 0) throw new Error(`Row ${rowId} not found in ${sheetKey}`);
  await fetch(
    `${_BASE}/values/${encodeURIComponent(name)}!A${rowIndex + 1}?valueInputOption=RAW`,
    {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [values] }),
    }
  );
}
```

- [ ] **Step 5: Append `deleteRowById` and `_getSheetNumericId`**

```javascript
async function _getSheetNumericId(sheetKey) {
  if (_sheetNumericIds[sheetKey] !== undefined) return _sheetNumericIds[sheetKey];
  const token  = await getToken();
  const res    = await fetch(`${_BASE}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data   = await res.json();
  data.sheets.forEach(s => {
    for (const [key, name] of Object.entries(SHEET_NAMES)) {
      if (s.properties.title === name) _sheetNumericIds[key] = s.properties.sheetId;
    }
  });
  return _sheetNumericIds[sheetKey];
}

async function deleteRowById(sheetKey, rowId) {
  const token    = await getToken();
  const name     = SHEET_NAMES[sheetKey];
  const colRes   = await fetch(`${_BASE}/values/${encodeURIComponent(name)}!A:A`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const col      = (await colRes.json()).values || [];
  const rowIndex = col.findIndex(cell => cell[0] === String(rowId));
  if (rowIndex < 0) throw new Error(`Row ${rowId} not found in ${sheetKey}`);
  const sheetId  = await _getSheetNumericId(sheetKey);
  await fetch(`${_BASE}:batchUpdate`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    }),
  });
}
```

- [ ] **Step 6: Append `seedSheets`**

```javascript
// ═══════════════════════════════════════════════════════
// SEED
// ═══════════════════════════════════════════════════════
async function seedSheets() {
  const token   = await getToken();
  const metaRes = await fetch(`${_BASE}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta     = await metaRes.json();
  const existing = new Set(meta.sheets.map(s => s.properties.title));

  // Create any missing tabs
  const missing = Object.values(SHEET_NAMES).filter(name => !existing.has(name));
  if (missing.length) {
    await fetch(`${_BASE}:batchUpdate`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: missing.map(title => ({ addSheet: { properties: { title } } })),
      }),
    });
  }

  // Write headers + seed data to empty tabs only
  for (const [key, name] of Object.entries(SHEET_NAMES)) {
    const checkRes  = await fetch(`${_BASE}/values/${encodeURIComponent(name)}!A1:A1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkData = await checkRes.json();
    if (checkData.values) continue; // already has content

    await fetch(
      `${_BASE}/values/${encodeURIComponent(name)}!A1?valueInputOption=RAW`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ values: [COLUMNS[key], ...SEED_DATA[key]] }),
      }
    );
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add static/sheets-api.js
git commit -m "feat: add sheets-api.js — Sheets operations and seed logic"
```

---

## Task 4: Update `static/index.html`

**Files:**
- Modify: `static/index.html`

Three changes: (1) fix asset paths (remove leading `/`), (2) add `<script>` tags for GIS, config.js, sheets-api.js, (3) add a sign-in overlay before the existing modals.

- [ ] **Step 1: Fix asset paths (leading `/` breaks GitHub Pages subdirectory hosting)**

In `static/index.html`, change:
```html
  <link rel="stylesheet" href="/style.css">
```
to:
```html
  <link rel="stylesheet" href="style.css">
```

And change the last script tag:
```html
<script src="/app.js"></script>
```
to:
```html
<script src="app.js"></script>
```

- [ ] **Step 2: Add GIS, config.js, and sheets-api.js script tags**

Replace the existing script block at the bottom of `<body>`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/he.js"></script>
<script src="/app.js"></script>
```
with:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/he.js"></script>
<script src="config.js"></script>
<script src="sheets-api.js"></script>
<script src="app.js"></script>
```

- [ ] **Step 3: Add sign-in overlay div**

Add this block immediately before the closing `</body>` tag (after the last `</div>` for the confirm overlay):

```html
<!-- ═══════════ SIGN-IN OVERLAY ═══════════ -->
<div id="signin-overlay" class="modal-overlay" style="background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center">
  <div class="modal modal-xs" onclick="event.stopPropagation()" style="text-align:center;padding:36px 40px">
    <div class="header-logo" style="margin:0 auto 16px;font-size:28px">ק</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:6px">ניהול תקציב פרסום</div>
    <div style="font-size:13px;color:#727272;margin-bottom:24px">מכללת קיי</div>
    <button id="signin-btn" class="btn btn-primary" style="width:100%;font-size:15px;padding:12px" onclick="startSignIn()">
      כניסה עם Google
    </button>
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add static/index.html
git commit -m "feat: update index.html — GIS scripts, fix paths, add sign-in overlay"
```

---

## Task 5: Update `static/app.js` — bootstrap and version

**Files:**
- Modify: `static/app.js`

Replace `loadData()` and the `DOMContentLoaded` listener. The `APP.version` field and `startSignIn` function are also added here.

- [ ] **Step 1: Replace the `DOMContentLoaded` listener and `loadData`**

Find and replace this block in `static/app.js`:

**OLD** (lines 111–133):
```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

async function loadData() {
  const [dataRes, versionRes] = await Promise.all([
    fetch('/api/data'),
    fetch('/api/version'),
  ]);
  APP.raw     = await dataRes.json();
  if (APP.raw.error) {
    document.body.innerHTML = `<div style="padding:40px;color:#c00;font-size:16px">שגיאה בטעינת נתונים: ${APP.raw.error}</div>`;
    return;
  }
  const vData = await versionRes.json();
  APP.version = vData.version || '';
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP.version;
  assignColors();
  initYearSelector();
  render();
  applyAllSectionStates(false);
}
```

**NEW**:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  // GIS is loaded async — wait for it before calling initAuth
  if (typeof google !== 'undefined' && google.accounts) {
    initAuth();
    _checkExistingSession();
  } else {
    window.onGoogleLibraryLoad = () => { initAuth(); _checkExistingSession(); };
  }
});

function _checkExistingSession() {
  const token  = sessionStorage.getItem('gis_token');
  const expiry = parseInt(sessionStorage.getItem('gis_expiry') || '0', 10);
  if (token && Date.now() < expiry) {
    document.getElementById('signin-overlay').style.display = 'none';
    loadData();
  }
  // else: sign-in overlay stays visible, user must click "כניסה עם Google"
}

async function startSignIn() {
  document.getElementById('signin-btn').disabled = true;
  document.getElementById('signin-btn').textContent = 'מתחבר...';
  const token = await signIn();
  if (!token) {
    document.getElementById('signin-btn').disabled = false;
    document.getElementById('signin-btn').textContent = 'כניסה עם Google';
    return;
  }
  document.getElementById('signin-overlay').style.display = 'none';
  loadData();
}

async function loadData() {
  try {
    await seedSheets();
    APP.raw = await readAllSheets();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:40px;color:#c00;font-size:16px">שגיאה בטעינת נתונים: ${e.message}</div>`;
    return;
  }
  APP.version = APP_VERSION;
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP.version;
  assignColors();
  initYearSelector();
  render();
  applyAllSectionStates(false);
}
```

- [ ] **Step 2: Commit**

```bash
git add static/app.js
git commit -m "feat: replace loadData — use sheets-api, GIS sign-in flow, APP_VERSION"
```

---

## Task 6: Update `static/app.js` — replace all `/api/` fetch calls

**Files:**
- Modify: `static/app.js`

Replace every remaining `fetch('/api/...')` call with the equivalent `sheets-api.js` function. There are 15 call sites across 10 functions.

- [ ] **Step 1: Replace `saveReserve`**

Find:
```javascript
  await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action, row }) });
```
Replace with:
```javascript
  if (action === 'create') {
    await appendRow('reserves', [row.id, row['שנה'], row['שם'], row['סכום'], row['תיאור']]);
  } else {
    await updateRowById('reserves', row.id, [row.id, row['שנה'], row['שם'], row['סכום'], row['תיאור']]);
  }
```

- [ ] **Step 2: Replace `deleteReserve`**

Find:
```javascript
    await fetch('/api/reserve', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
```
Replace with:
```javascript
    await deleteRowById('reserves', id);
```

- [ ] **Step 3: Replace `saveTransaction`**

Find:
```javascript
  await fetch('/api/transaction', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ action, row }),
  });
```
Replace with:
```javascript
  const txnValues = [row.id, row['שנה'], row['תאריך'], row['ספק'], row['מס_חשבונית'], row['תיאור'], row['סכום'], row['סטטוס'], row['מחלקה']];
  if (action === 'create') {
    await appendRow('transactions', txnValues);
  } else {
    await updateRowById('transactions', row.id, txnValues);
  }
```

- [ ] **Step 4: Replace `deleteTransaction`**

Find:
```javascript
    await fetch('/api/transaction', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'delete', id }) });
```
Replace with:
```javascript
    await deleteRowById('transactions', id);
```

- [ ] **Step 5: Replace `updateSupplierDept`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'update', row }) });
```
(in the `updateSupplierDept` function)

Replace with:
```javascript
  await updateRowById('suppliers', id, [id, name, active, deptName]);
```

- [ ] **Step 6: Replace `addSupplier`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'create', row }) });
```
Replace with:
```javascript
  await appendRow('suppliers', [row.id, row['שם'], row['פעיל'], row['מחלקה']]);
```

- [ ] **Step 7: Replace `toggleSupplierActive`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'update', row }) });
```
(in the `toggleSupplierActive` function — note there are two fetch calls to `/api/settings` for suppliers; this one is inside `toggleSupplierActive`)

Replace with:
```javascript
  await updateRowById('suppliers', id, [id, name, newActive, s ? (s['מחלקה'] || '') : '']);
```

- [ ] **Step 8: Replace `deleteSupplier`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'supplier', action: 'delete', id }) });
```
(in `deleteSupplier`)

Replace with:
```javascript
  await deleteRowById('suppliers', id);
```

- [ ] **Step 9: Replace `addStatus`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'create', row }) });
```
Replace with:
```javascript
  await appendRow('statuses', [row.id, row['שם'], row['צבע']]);
```

- [ ] **Step 10: Replace `deleteStatus`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'status', action: 'delete', id }) });
```
Replace with:
```javascript
  await deleteRowById('statuses', id);
```

- [ ] **Step 11: Replace `addDepartment`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'department', action: 'create', row }) });
```
Replace with:
```javascript
  await appendRow('departments', [row.id, row['שם'], row['ברירת_מחדל']]);
```

- [ ] **Step 12: Replace `setDefaultDept` (two calls)**

Find and replace the entire `setDefaultDept` function body. Currently it has two fetch calls. Replace both:

**OLD**:
```javascript
async function setDefaultDept(id) {
  const prev = APP.raw.departments.find(d => d['ברירת_מחדל'] === 'TRUE');
  if (prev && prev.id !== id) {
    const prevRow = { ...prev, ברירת_מחדל: 'FALSE' };
    await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ type: 'department', action: 'update', row: prevRow }) });
    prev['ברירת_מחדל'] = 'FALSE';
  }
  const next = APP.raw.departments.find(d => d.id === id);
  if (next) {
    const nextRow = { ...next, ברירת_מחדל: 'TRUE' };
    await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ type: 'department', action: 'update', row: nextRow }) });
    next['ברירת_מחדל'] = 'TRUE';
  }
}
```

**NEW**:
```javascript
async function setDefaultDept(id) {
  const prev = APP.raw.departments.find(d => d['ברירת_מחדל'] === 'TRUE');
  if (prev && prev.id !== id) {
    await updateRowById('departments', prev.id, [prev.id, prev['שם'], 'FALSE']);
    prev['ברירת_מחדל'] = 'FALSE';
  }
  const next = APP.raw.departments.find(d => d.id === id);
  if (next) {
    await updateRowById('departments', next.id, [next.id, next['שם'], 'TRUE']);
    next['ברירת_מחדל'] = 'TRUE';
  }
}
```

- [ ] **Step 13: Replace `deleteDepartment`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'department', action: 'delete', id }) });
```
Replace with:
```javascript
  await deleteRowById('departments', id);
```

- [ ] **Step 14: Replace `updateYear`**

Find the entire `updateYear` function:
```javascript
async function updateYear(yearStr, budget, endMonth) {
  const row = { שנה: yearStr, תקציב_פתיחה: budget, חודש_סיום: endMonth };
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'update', row }) });
  const y = APP.raw.budget.find(r => r['שנה'] === yearStr);
  if (y) { y['תקציב_פתיחה'] = budget; y['חודש_סיום'] = endMonth; }
  renderKPIs();
}
```

Replace with:
```javascript
async function updateYear(yearStr, budget, endMonth) {
  await updateRowById('budget', yearStr, [yearStr, budget, endMonth]);
  const y = APP.raw.budget.find(r => r['שנה'] === yearStr);
  if (y) { y['תקציב_פתיחה'] = budget; y['חודש_סיום'] = endMonth; }
  renderKPIs();
}
```

- [ ] **Step 15: Replace `addYear`**

Find:
```javascript
  await fetch('/api/settings', { method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type: 'year', action: 'create', row }) });
```
Replace with:
```javascript
  await appendRow('budget', [row['שנה'], row['תקציב_פתיחה'], row['חודש_סיום']]);
```

- [ ] **Step 16: Verify no `/api/` fetch calls remain**

Run this search — it must return zero results:
```bash
grep -n "fetch('/api/" static/app.js
```
Expected: no output.

- [ ] **Step 17: Commit**

```bash
git add static/app.js
git commit -m "feat: replace all /api/ fetch calls with sheets-api.js functions"
```

---

## Task 7: Delete backend files

**Files:**
- Delete: `app.py`, `sheets.py`, `launcher.py`, `launch.vbs`, `launch.bat`
- Delete: `requirements.txt`, `config.template.json`, `version.txt`
- Delete: `tests/` directory
- Delete: `.github/workflows/release-asset.yml`
- Delete: `generate_icon.py`, `icon-params.md`, `icon.png`, `launch.ico`

- [ ] **Step 1: Delete Python and launcher files**

```bash
git rm app.py sheets.py launcher.py launch.vbs launch.bat
git rm requirements.txt config.template.json version.txt
git rm -r tests/
git rm .github/workflows/release-asset.yml
```

- [ ] **Step 2: Delete icon/launcher assets (if they exist)**

```bash
git rm --ignore-unmatch generate_icon.py icon-params.md icon.png launch.ico
```

- [ ] **Step 3: Update `.gitignore` — remove stale entries**

Open `.gitignore` and remove these lines (no longer relevant):
```
credentials.json
config.json
version.txt
__pycache__/
*.pyc
.pytest_cache/
venv/
.venv/
```

The file should end up containing only:
```
.claude/settings.local.json
node_modules/
.env
.superpowers/
*.xlsx
package.json
package-lock.json
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: delete Flask backend, launchers, tests, CI release workflow"
```

---

## Task 8: Update `CLAUDE.md` and `README.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Rewrite `CLAUDE.md`**

Replace the entire contents of `CLAUDE.md` with:

```markdown
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
```

- [ ] **Step 2: Rewrite `README.md`**

Replace the entire contents of `README.md` with:

```markdown
# ניהול תקציב פרסום — Advertising Budget Manager

A lightweight web app for tracking advertising spend against a Google Sheets spreadsheet.
Hosted on GitHub Pages. No installation required — open in any browser.

**Production URL:** https://so0osh.github.io/kaye-budget-mgmt

---

## Usage

1. Open the URL above in any browser.
2. Click **כניסה עם Google** and sign in with the Google account that owns the spreadsheet.
3. On first run, the app creates any missing sheet tabs and writes default data automatically.

---

## Setup (one-time, for developers)

### 1. Google Cloud — OAuth2 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project. Enable the **Google Sheets API**.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Authorized JavaScript origins: `https://so0osh.github.io`
6. Copy the generated **Client ID**.
7. Go to **OAuth consent screen**:
   - User type: **External**
   - Publishing status: **Testing**
   - Add the owner's Gmail as a test user.

### 2. `static/config.js`

Fill in the two values:

```javascript
const SPREADSHEET_ID  = 'your-spreadsheet-id-here';   // from the Google Sheets URL
const OAUTH_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
const APP_VERSION     = 'v1.x.x';
```

Commit and push. GitHub Pages deploys automatically.

### 3. GitHub repo settings

- Repo must be **public**.
- Settings → Pages → Branch: `main`, Folder: `/static`.

### 4. Google Spreadsheet

- Create a new Google Sheet (or use an existing one).
- Sharing: restricted to the owner's Gmail only.
- No need to create tabs manually — `seedSheets()` handles it on first load.

---

## Deployment

```bash
git push origin main
```

GitHub Pages deploys within ~60 seconds. No build step.

---

## Updating the version

Edit `APP_VERSION` in `static/config.js` and push.

---

## Project Structure

```
static/
  index.html      SPA shell
  style.css       Styles (RTL Hebrew)
  app.js          UI logic
  sheets-api.js   Google Sheets API wrapper + GIS auth
  config.js       SPREADSHEET_ID, OAUTH_CLIENT_ID, APP_VERSION
docs/
  superpowers/    Design specs and implementation plans
```
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLAUDE.md and README.md for GitHub Pages + OAuth2 architecture"
```

---

## Task 9: One-time Google Cloud + GitHub Pages setup (manual steps)

This task is performed by the developer in the browser, not by code. No commit needed.

- [ ] **Step 1: Create OAuth2 Client ID in Google Cloud Console**

  1. Go to https://console.cloud.google.com/
  2. Select or create a project.
  3. Navigate to **APIs & Services → Library** → search "Google Sheets API" → Enable it.
  4. Navigate to **APIs & Services → Credentials → + Create Credentials → OAuth client ID**.
  5. Application type: **Web application**.
  6. Name: anything (e.g. "Budget Manager").
  7. Authorized JavaScript origins: add `https://so0osh.github.io`
  8. Click **Create**. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

- [ ] **Step 2: Configure the OAuth consent screen**

  1. Navigate to **APIs & Services → OAuth consent screen**.
  2. User type: **External** → Create.
  3. App name: anything. Support email: your Gmail. Developer email: your Gmail.
  4. Scopes: skip (the app requests the scope at runtime).
  5. Test users: add your Gmail address.
  6. Publishing status: leave as **Testing** (no verification needed for single-user).

- [ ] **Step 3: Fill in `static/config.js`**

  Open `static/config.js` and replace the placeholder values:
  - `SPREADSHEET_ID`: the long string from your Google Sheets URL between `/d/` and `/edit`
  - `OAUTH_CLIENT_ID`: the Client ID copied in Step 1

  Commit and push:
  ```bash
  git add static/config.js
  git commit -m "config: set spreadsheet ID and OAuth client ID"
  git push origin main
  ```

- [ ] **Step 4: Make the GitHub repo public**

  GitHub → repo Settings → Danger Zone → **Change repository visibility** → Public.

- [ ] **Step 5: Enable GitHub Pages**

  GitHub → repo Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, Folder: `/static` → Save.

  Wait ~60 seconds, then open: `https://so0osh.github.io/kaye-budget-mgmt`

- [ ] **Step 6: Smoke test**

  1. Open the URL in a browser.
  2. Sign-in overlay appears → click **כניסה עם Google** → Google account picker → sign in.
  3. App loads: KPIs, charts, journal all render.
  4. Add a test transaction → verify it appears in the journal and in the Google Sheet.
  5. Edit the transaction → verify the sheet row updates.
  6. Delete the transaction → verify the sheet row is removed.
  7. Open a new tab (same browser) → app loads without sign-in prompt (token in sessionStorage).

---

## Self-Review Checklist

- [x] `readAllSheets` covers all 6 sheet keys matching `SHEET_NAMES`
- [x] `seedSheets` creates missing tabs before checking for content
- [x] `updateRowById` for budget uses the year string as the ID (column A = year string, not numeric ID)
- [x] `deleteRowById` fetches numeric sheetId lazily and caches it
- [x] All 15 `fetch('/api/...')` call sites in `app.js` are replaced
- [x] `setDefaultDept` makes two `updateRowById` calls (un-default previous, default new)
- [x] Asset paths in `index.html` use relative paths (`style.css`, `app.js`) not absolute (`/style.css`)
- [x] GIS script tag uses `async defer` so `onGoogleLibraryLoad` fires correctly
- [x] Sign-in overlay shown by default; hidden after successful token receipt
- [x] `APP_VERSION` sourced from `config.js`, not from a removed `/api/version` endpoint
