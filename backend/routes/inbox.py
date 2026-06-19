import os
from flask import Blueprint, jsonify, request


def create_inbox_blueprint(inbox, logger):
    bp = Blueprint("inbox", __name__)

    @bp.route("/inbox-items", methods=["GET"])
    def inbox_items():
        items = inbox.fetch_inbox_items()
        inbox_rel = os.path.relpath(inbox.inbox_file, inbox.vault_path).replace(os.sep, "/")
        return jsonify({"count": len(items), "items": items, "inbox_rel_path": inbox_rel})

    @bp.route("/inbox/add", methods=["POST"])
    def add_inbox_item():
        data = request.get_json() or {}
        description = data.get("description", "").strip()
        if not description:
            return jsonify({"error": "Description required"}), 400
        try:
            line = inbox.add_inbox_item(description)
            return jsonify({"status": "success", "raw_line": line})
        except Exception as e:
            logger.error(f"Failed to add inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/inbox/update", methods=["POST"])
    def update_inbox_item():
        data = request.get_json() or {}
        raw_line = data.get("raw_line")
        new_line = data.get("new_line")
        if not raw_line or not new_line:
            return jsonify({"error": "raw_line and new_line required"}), 400
        try:
            inbox.update_inbox_item(raw_line, new_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to update inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/inbox/delete", methods=["POST"])
    def delete_inbox_item():
        data = request.get_json() or {}
        raw_line = data.get("raw_line")
        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400
        try:
            inbox.delete_inbox_item(raw_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to delete inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/inbox/move", methods=["POST"])
    def move_inbox_item():
        data = request.get_json() or {}
        raw_line = data.get("raw_line")
        new_line = data.get("new_line") or raw_line
        target_path = (data.get("target_path") or "").strip()

        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400

        if not target_path:
            target_abs = inbox.imploding_tasks_file
        else:
            if not target_path.endswith(".md"):
                target_path += ".md"
            target_abs = os.path.join(inbox.vault_path, target_path)

        try:
            inbox.move_to_file(raw_line, new_line, target_abs)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to move inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/inbox/done", methods=["POST"])
    def done_inbox_item():
        data = request.get_json() or {}
        raw_line = data.get("raw_line")
        new_line = data.get("new_line") or raw_line
        target_path = (data.get("target_path") or "").strip()
        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400
        if not target_path:
            target_abs = inbox.imploding_tasks_file
        else:
            if not target_path.endswith(".md"):
                target_path += ".md"
            target_abs = os.path.join(inbox.vault_path, target_path)
        try:
            inbox.done_inbox_item(raw_line, new_line, target_abs)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to complete inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/inbox/complete", methods=["POST"])
    def complete_inbox_item():
        data = request.get_json() or {}
        raw_line = data.get("raw_line")
        if not raw_line:
            return jsonify({"error": "raw_line required"}), 400
        try:
            inbox.complete_inbox_item(raw_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to complete inbox item: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route("/vault-files", methods=["GET"])
    def vault_files():
        files = inbox.list_vault_files()
        return jsonify({"files": files})

    @bp.route("/vault-tags", methods=["GET"])
    def vault_tags():
        tags = inbox.list_vault_tags()
        return jsonify({"tags": tags})

    return bp
