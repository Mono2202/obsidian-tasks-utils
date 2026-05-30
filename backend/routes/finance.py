from datetime import datetime
from flask import Blueprint, jsonify, request


def create_finance_blueprint(finance, logger):
    bp = Blueprint('finance', __name__)

    @bp.route('/finance/entries', methods=['GET'])
    def get_entries():
        if finance is None:
            return jsonify({'error': 'Finance not configured'}), 503
        month = request.args.get('month', datetime.now().strftime('%Y-%m'))
        try:
            entries = finance.get_entries(month)
            return jsonify({'entries': entries, 'month': month})
        except Exception as e:
            logger.error(f"Finance get_entries error: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/finance/subscriptions', methods=['GET'])
    def get_subscriptions():
        if finance is None:
            return jsonify({'error': 'Finance not configured'}), 503
        try:
            return jsonify({'subscriptions': finance.get_subscriptions()})
        except Exception as e:
            logger.error(f"Finance get_subscriptions error: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/finance/add', methods=['POST'])
    def add_entry():
        if finance is None:
            return jsonify({'error': 'Finance not configured'}), 503
        data = request.get_json()
        title = (data.get('title') or '').strip()
        category = (data.get('category') or '').strip()
        month = data.get('month', datetime.now().strftime('%Y-%m'))
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        if not category:
            return jsonify({'error': 'Category is required'}), 400
        try:
            amount = float(data.get('amount'))
            if amount <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return jsonify({'error': 'Amount must be a positive number'}), 400
        try:
            finance.add_entry(month, title, category, amount)
            return jsonify({'status': 'ok', 'entries': finance.get_entries(month)})
        except Exception as e:
            logger.error(f"Finance add_entry error: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/finance/delete', methods=['POST'])
    def delete_entry():
        if finance is None:
            return jsonify({'error': 'Finance not configured'}), 503
        data = request.get_json()
        month = data.get('month')
        index = data.get('index')
        if month is None or index is None:
            return jsonify({'error': 'month and index are required'}), 400
        try:
            finance.delete_entry(month, int(index))
            return jsonify({'status': 'ok', 'entries': finance.get_entries(month)})
        except IndexError as e:
            return jsonify({'error': str(e)}), 404
        except Exception as e:
            logger.error(f"Finance delete_entry error: {e}")
            return jsonify({'error': str(e)}), 500

    return bp
