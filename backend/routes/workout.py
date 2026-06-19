from datetime import date
from flask import Blueprint, jsonify, request
from backend.notifications import rest_timer


def create_workout_blueprint(obsidian, logger, pushover=None):
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

    @bp.route('/workout/exercises', methods=['GET'])
    def workout_exercises():
        exercises = obsidian.fetch_exercise_suggestions()
        return jsonify({'exercises': exercises})

    @bp.route('/workout/progress', methods=['GET'])
    def workout_progress():
        exercise = request.args.get('exercise', '').strip()
        if not exercise:
            return jsonify({'error': 'exercise is required'}), 400
        try:
            return jsonify({'progress': obsidian.get_exercise_progress(exercise)})
        except Exception as e:
            logger.error(f"Failed to fetch progress for {exercise}: {e}")
            return jsonify({'error': str(e)}), 500

    @bp.route('/workout/rest-start', methods=['POST'])
    def rest_start():
        data = request.json or {}
        end_time = data.get('end_time')
        if end_time is None:
            return jsonify({'error': 'end_time is required'}), 400
        rest_timer.set_timer(float(end_time))
        return jsonify({'status': 'ok'})

    @bp.route('/workout/rest-cancel', methods=['POST'])
    def rest_cancel():
        rest_timer.cancel_timer()
        return jsonify({'status': 'ok'})

    @bp.route('/workout/rest-done', methods=['POST'])
    def rest_done():
        rest_timer.cancel_timer()
        try:
            if pushover:
                pushover.send_message(
                    message="Rest time is up — time for your next set! 💪",
                    title="Workout Timer"
                )
        except Exception as e:
            logger.error(f"Failed to send rest timer notification: {e}")
        return jsonify({'status': 'ok'})

    @bp.route('/workout/records', methods=['GET'])
    def workout_records():
        try:
            records = obsidian.get_personal_records()
            return jsonify({'records': records})
        except Exception as e:
            logger.error(f"Failed to fetch records: {e}")
            return jsonify({'error': str(e)}), 500

    return bp
