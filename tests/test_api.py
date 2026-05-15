from unittest.mock import patch, MagicMock

MOCK_DATA = {
    'budget':       [{'שנה': '2025/2026', 'תקציב_פתיחה': '700000', 'חודש_סיום': '8'}],
    'transactions': [
        {'id': '111', 'שנה': '2025/2026', 'תאריך': '01/11/2025',
         'ספק': 'גוגל', 'מס_חשבונית': '123', 'תיאור': 'test', 'סכום': '2500',
         'סטטוס': 'שולם', 'מחלקה': 'שיווק'}
    ],
    'suppliers':    [{'id': '1', 'שם': 'גוגל', 'פעיל': 'TRUE', 'מחלקה': 'שיווק'}],
    'statuses':     [{'id': '2', 'שם': 'שולם', 'צבע': '#2bac76'}],
    'reserves':     [],
    'departments':  [{'id': '3', 'שם': 'שיווק', 'ברירת_מחדל': 'TRUE'}],
}


# /api/data

@patch('app.sheets.read_all_sheets')
def test_get_data_returns_six_keys(mock_read, client):
    mock_read.return_value = MOCK_DATA
    r = client.get('/api/data')
    assert r.status_code == 200
    assert set(r.get_json().keys()) == {
        'budget', 'transactions', 'suppliers', 'statuses', 'reserves', 'departments'
    }


@patch('app.sheets.read_all_sheets')
def test_get_data_error_returns_500(mock_read, client):
    mock_read.side_effect = Exception('api down')
    r = client.get('/api/data')
    assert r.status_code == 500
    assert 'error' in r.get_json()


# /api/transaction

TXN_ROW = {
    'id': '999', 'שנה': '2025/2026', 'תאריך': '01/01/2026',
    'ספק': 'גוגל', 'מס_חשבונית': '456', 'תיאור': '', 'סכום': '1000',
    'סטטוס': 'שולם', 'מחלקה': 'שיווק'
}


@patch('app.sheets.append_row')
def test_create_transaction(mock_append, client):
    r = client.post('/api/transaction', json={'action': 'create', 'row': TXN_ROW})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_append.assert_called_once_with('transactions', [
        '999', '2025/2026', '01/01/2026', 'גוגל', '456', '', '1000', 'שולם', 'שיווק'
    ])


@patch('app.sheets.update_row_by_id')
def test_update_transaction(mock_update, client):
    r = client.post('/api/transaction', json={'action': 'update', 'row': TXN_ROW})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_update.assert_called_once_with('transactions', '999', [
        '999', '2025/2026', '01/01/2026', 'גוגל', '456', '', '1000', 'שולם', 'שיווק'
    ])


@patch('app.sheets.delete_row_by_id')
def test_delete_transaction(mock_delete, client):
    r = client.post('/api/transaction', json={'action': 'delete', 'id': '111'})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_delete.assert_called_once_with('transactions', '111')


def test_transaction_unknown_action_returns_400(client):
    r = client.post('/api/transaction', json={'action': 'explode', 'row': TXN_ROW})
    assert r.status_code == 400


# /api/reserve

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
    assert r.get_json()['ok'] is True
    mock_delete.assert_called_once_with('reserves', '888')


# /api/settings

@patch('app.sheets._read_sheet')
def test_get_settings(mock_read, client):
    mock_read.side_effect = lambda key: {
        'suppliers':   [{'id': '1', 'שם': 'גוגל', 'פעיל': 'TRUE', 'מחלקה': 'שיווק'}],
        'statuses':    [{'id': '2', 'שם': 'שולם', 'צבע': '#2bac76'}],
        'budget':      [{'שנה': '2025/2026', 'תקציב_פתיחה': '700000', 'חודש_סיום': '8'}],
        'departments': [{'id': '3', 'שם': 'שיווק', 'ברירת_מחדל': 'TRUE'}],
    }[key]
    r = client.get('/api/settings')
    assert r.status_code == 200
    body = r.get_json()
    assert body['suppliers'] == [{'id': '1', 'שם': 'גוגל', 'פעיל': 'TRUE', 'מחלקה': 'שיווק'}]
    assert body['statuses']  == [{'id': '2', 'שם': 'שולם', 'צבע': '#2bac76'}]
    assert body['budget']    == [{'שנה': '2025/2026', 'תקציב_פתיחה': '700000', 'חודש_סיום': '8'}]
    assert body['departments'] == [{'id': '3', 'שם': 'שיווק', 'ברירת_מחדל': 'TRUE'}]


@patch('app.sheets.append_row')
def test_create_supplier(mock_append, client):
    row = {'id': '777', 'שם': 'ספק חדש', 'פעיל': 'TRUE', 'מחלקה': 'שיווק'}
    r = client.post('/api/settings', json={'type': 'supplier', 'action': 'create', 'row': row})
    assert r.status_code == 200
    mock_append.assert_called_once_with('suppliers', ['777', 'ספק חדש', 'TRUE', 'שיווק'])


@patch('app.sheets.delete_row_by_id')
def test_delete_status(mock_delete, client):
    r = client.post('/api/settings', json={'type': 'status', 'action': 'delete', 'id': '2'})
    assert r.status_code == 200
    mock_delete.assert_called_once_with('statuses', '2')


# /api/settings - department CRUD

@patch('app.sheets.append_row')
def test_create_department(mock_append, client):
    row = {'id': '500', 'שם': 'שיווק', 'ברירת_מחדל': 'TRUE'}
    r = client.post('/api/settings', json={'type': 'department', 'action': 'create', 'row': row})
    assert r.status_code == 200
    assert r.get_json()['ok'] is True
    mock_append.assert_called_once_with('departments', ['500', 'שיווק', 'TRUE'])


@patch('app.sheets.update_row_by_id')
def test_update_department(mock_update, client):
    row = {'id': '500', 'שם': 'שיווק', 'ברירת_מחדל': 'FALSE'}
    r = client.post('/api/settings', json={'type': 'department', 'action': 'update', 'row': row})
    assert r.status_code == 200
    mock_update.assert_called_once_with('departments', '500', ['500', 'שיווק', 'FALSE'])


@patch('app.sheets.delete_row_by_id')
def test_delete_department(mock_delete, client):
    r = client.post('/api/settings', json={'type': 'department', 'action': 'delete', 'id': '500'})
    assert r.status_code == 200
    mock_delete.assert_called_once_with('departments', '500')


# /api/version

def test_version_endpoint_returns_200(client):
    r = client.get('/api/version')
    assert r.status_code == 200
    data = r.get_json()
    assert 'version' in data
    assert isinstance(data['version'], str)


# Post-plan additions

def test_transaction_missing_body_returns_400(client):
    r = client.post('/api/transaction', data='not json', content_type='text/plain')
    assert r.status_code == 400


def test_settings_unknown_type_returns_400(client):
    r = client.post('/api/settings', json={'type': 'bogus', 'action': 'create'})
    assert r.status_code == 400


@patch('app.sheets.append_row')
def test_create_year(mock_append, client):
    row = {'שנה': '2026/2027', 'תקציב_פתיחה': '800000', 'חודש_סיום': '8'}
    r = client.post('/api/settings', json={'type': 'year', 'action': 'create', 'row': row})
    assert r.status_code == 200
    mock_append.assert_called_once_with('budget', ['2026/2027', '800000', '8'])
