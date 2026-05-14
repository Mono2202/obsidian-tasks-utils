from datetime import date
from flask import Blueprint, jsonify, request


def create_workout_blueprint(obsidian, logger):
    bp = Blueprint('workout', __name__)

    @bp.route('/workout/today', methods=['GET'])
    def workout_today():
        today = date.today().strftime('%Y-%m-%d')
        exercises = obsidian.fetch_workout(today)
        return jsonify({'date': today, 'exercises': exercises})

    @bp.route('/workout/add', methods=['POST'])
    def workout_add():
        data = request.json or {}
        name = data.get('name', '').strip()
        sets = data.get('sets')
        reps = data.get('reps')
        weight = data.get('weight', '').strip() or None
        if not name or sets is None or reps is None:
            return jsonify({'error': 'name, sets and reps are required'}), 400
        try:
            today = date.today().strftime('%Y-%m-%d')
            obsidian.add_exercise(today, name, int(sets), int(reps), weight)
            exercises = obsidian.fetch_workout(today)
            return jsonify({'status': 'ok', 'exercises': exercises})
        except Exception as e:
            logger.error(f"Failed to add exercise: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/workout/delete', methods=['POST'])
    def workout_delete():
        data = request.json or {}
        index = data.get('index')
        if index is None:
            return jsonify({'error': 'index is required'}), 400
        try:
            today = date.today().strftime('%Y-%m-%d')
            obsidian.delete_exercise(today, int(index))
            exercises = obsidian.fetch_workout(today)
            return jsonify({'status': 'ok', 'exercises': exercises})
        except ValueError as e:
            return jsonify({'error': str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to delete exercise: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/workout/history', methods=['GET'])
    def workout_history():
        history = obsidian.fetch_workout_history(days=14)
        return jsonify({'history': history})

    return bp
