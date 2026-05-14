from flask import Blueprint, jsonify


def create_habits_blueprint(obsidian, logger):
    bp = Blueprint('habits', __name__)

    @bp.route('/habits', methods=['GET'])
    def habits():
        return jsonify({"habits": obsidian.fetch_habits()})

    @bp.route('/complete-habit/<path:name>', methods=['POST'])
    def complete_habit(name):
        try:
            obsidian.complete_habit(name)
            return jsonify({"status": "success"}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 409
        except Exception as e:
            logger.error(f"Failed to complete habit '{name}': {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/uncomplete-habit/<path:name>', methods=['POST'])
    def uncomplete_habit(name):
        try:
            obsidian.uncomplete_habit(name)
            return jsonify({"status": "success"}), 200
        except ValueError as e:
            return jsonify({"error": str(e)}), 409
        except Exception as e:
            logger.error(f"Failed to uncomplete habit '{name}': {e}")
            return jsonify({"error": str(e)}), 500

    return bp
