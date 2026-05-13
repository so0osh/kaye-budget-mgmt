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
