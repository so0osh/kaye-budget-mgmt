import webbrowser
import threading
from flask import Flask, jsonify, request, send_from_directory
import sheets


def create_app(config=None):
    app = Flask(__name__, static_folder='static', static_url_path='')

    if config:
        app.config.update(config)

    with app.app_context():
        if not app.config.get('TESTING'):
            try:
                sheets.seed_sheets()
            except Exception as e:
                app.logger.warning('seed_sheets() failed: %s', e)

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
        try:
            body = request.get_json(silent=True)
            if body is None:
                return jsonify({'ok': False, 'error': 'Request body must be valid JSON'}), 400
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

    @app.route('/api/reserve', methods=['POST'])
    def reserve():
        try:
            body = request.get_json(silent=True)
            if body is None:
                return jsonify({'ok': False, 'error': 'Request body must be valid JSON'}), 400
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

    @app.route('/api/settings', methods=['GET', 'POST'])
    def settings():
        try:
            if request.method == 'GET':
                return jsonify({
                    'suppliers': sheets._read_sheet('suppliers'),
                    'statuses':  sheets._read_sheet('statuses'),
                    'budget':    sheets._read_sheet('budget'),
                })

            body = request.get_json(silent=True)
            if body is None:
                return jsonify({'ok': False, 'error': 'Request body must be valid JSON'}), 400
            sheet_key = body['type']
            action = body['action']

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
                else:
                    return jsonify({'ok': False, 'error': f'unknown action: {action}'}), 400

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
                else:
                    return jsonify({'ok': False, 'error': f'unknown action: {action}'}), 400

            elif sheet_key == 'year':
                row = body.get('row', {})
                if action == 'create':
                    sheets.append_row('budget',
                        [row['שנה'], row['תקציב_פתיחה'], row['חודש_סיום']])
                elif action == 'update':
                    sheets.update_row_by_id('budget', row['שנה'],
                        [row['שנה'], row['תקציב_פתיחה'], row['חודש_סיום']])
                elif action == 'delete':
                    sheets.delete_row_by_id('budget', body['id'])
                else:
                    return jsonify({'ok': False, 'error': f'unknown action: {action}'}), 400

            else:
                return jsonify({'ok': False, 'error': f'unknown type: {sheet_key}'}), 400

            return jsonify({'ok': True})

        except Exception as e:
            return jsonify({'ok': False, 'error': str(e)}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    threading.Timer(1.2, lambda: webbrowser.open('http://localhost:5000')).start()
    app.run(port=5000, debug=False)
