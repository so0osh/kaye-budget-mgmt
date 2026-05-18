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
