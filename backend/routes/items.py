import os
from flask import Blueprint, jsonify, request


def create_items_blueprint(inbox, obsidian, logger):
    bp = Blueprint("items", __name__)

    def _resolve_target(target_path):
        if not target_path:
            return None
        if not target_path.endswith(".md"):
            target_path += ".md"
        return os.path.join(inbox.vault_path, target_path)

    @bp.route("/item/save", methods=["POST"])
    def save_item():
        data = request.get_json() or {}
        source = data.get("source")
        raw_line = data.get("raw_line")
        new_line = data.get("new_line")
        rel_path = (data.get("rel_path") or "").strip()
        target_path = (data.get("target_path") or "").strip()

        if not raw_line or not new_line:
            return jsonify({"error": "raw_line and new_line required"}), 400

        target_abs = _resolve_target(target_path)

        try:
            if source == "inbox":
                inbox.move_to_file(raw_line, new_line, target_abs or inbox.imploding_tasks_file)
            else:
                file_path = os.path.join(obsidian.vault_path, rel_path)
                if target_abs:
                    obsidian.move_task_to_file(file_path, raw_line, new_line, target_abs)
                else:
                    obsidian.update_task(file_path, raw_line, new_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to save item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/item/complete", methods=["POST"])
    def complete_item():
        data = request.get_json() or {}
        source = data.get("source")
        raw_line = data.get("raw_line")
        new_line = (data.get("new_line") or raw_line)
        rel_path = (data.get("rel_path") or "").strip()
        target_path = (data.get("target_path") or "").strip()

        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400

        try:
            if source == "inbox":
                target_abs = _resolve_target(target_path) or inbox.imploding_tasks_file
                inbox.done_inbox_item(raw_line, new_line, target_abs)
            else:
                file_path = os.path.join(obsidian.vault_path, rel_path)
                # If fields changed, update first then complete the updated line
                if new_line.rstrip() != raw_line.rstrip():
                    obsidian.update_task(file_path, raw_line, new_line)
                    obsidian.complete_task(file_path, new_line)
                else:
                    obsidian.complete_task(file_path, raw_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to complete item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/item/delete", methods=["POST"])
    def delete_item():
        data = request.get_json() or {}
        source = data.get("source")
        raw_line = data.get("raw_line")
        rel_path = (data.get("rel_path") or "").strip()

        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400

        try:
            if source == "inbox":
                inbox.delete_inbox_item(raw_line)
            else:
                file_path = os.path.join(obsidian.vault_path, rel_path)
                obsidian.delete_task(file_path, raw_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to delete item: {e}")
            return jsonify({"error": str(e)}), 500

    return bp
