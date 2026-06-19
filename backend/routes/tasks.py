import os
import re
import time
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request

UNDO_WINDOW = 30

def create_tasks_blueprint(obsidian, tasks_store, logger):
    bp = Blueprint('tasks', __name__)
    undo_store = {}

    @bp.route('/today-tasks', methods=['GET'])
    def today_tasks():
        new_tasks = obsidian.fetch_today_tasks()
        tasks_store.clear()
        tasks_store.update(new_tasks)
        logger.info(f"Fetched {len(tasks_store)} tasks for today")
        serializable = {
            k: {f: v for f, v in t.items() if f != 'file_path'}
            for k, t in tasks_store.items()
        }
        return jsonify({
            "count": len(tasks_store),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "tasks": serializable,
        })

    @bp.route('/complete-task/<task_id>', methods=['POST'])
    def complete_task(task_id):
        task = tasks_store.get(task_id)
        if not task:
            return jsonify({"error": "Task not found. Refresh and try again."}), 404
        try:
            new_task_line = obsidian.complete_task(task["file_path"], task["raw_line"])
            undo_store[task_id] = {
                "task": task,
                "new_task_line": new_task_line,
                "expires_at": time.time() + UNDO_WINDOW,
            }
            del tasks_store[task_id]
            logger.info(f"Task completed: {task['task']}")
            return jsonify({"status": "success"}), 200
        except Exception as e:
            logger.error(f"Failed to complete task {task_id}: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/undo-complete-task/<task_id>', methods=['POST'])
    def undo_complete_task(task_id):
        entry = undo_store.pop(task_id, None)
        if not entry:
            return jsonify({"error": "Nothing to undo."}), 404
        if time.time() > entry["expires_at"]:
            return jsonify({"error": "Undo window expired."}), 410
        try:
            task = entry["task"]
            obsidian.undo_complete_task(task["file_path"], task["raw_line"], entry["new_task_line"])
            tasks_store[task_id] = task
            logger.info(f"Task completion undone: {task['raw_line'].strip()}")
            return jsonify({"status": "success"}), 200
        except Exception as e:
            logger.error(f"Failed to undo task {task_id}: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/add-task', methods=['GET'])
    def add_task():
        task_description = request.args.get('task')
        if not task_description:
            return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400

        formatted_task = f"- [ ] #todo {task_description.strip()}"
        try:
            with open(obsidian.inbox_file, "a", encoding="utf-8") as f:
                f.write(f"{formatted_task}\n")
            logger.info(f"Task added to Inbox: {formatted_task}")
            return jsonify({
                "status": "success",
                "message": "Task appended to Inbox",
                "formatted_line": formatted_task,
            }), 200
        except Exception as e:
            logger.error(f"Failed to add inbox task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/add-today-task', methods=['GET'])
    def add_today_task():
        task_description = request.args.get('task')
        task_time = request.args.get('time')

        if not task_description:
            return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400
        if task_time and not re.match(r'^\d{2}:\d{2}$', task_time):
            return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

        try:
            formatted_task = obsidian.add_task_to_today(task_description, task_time)
            logger.info(f"Task added to today: {formatted_task}")
            return jsonify({
                "status": "success",
                "message": "Task added to today's daily note",
                "formatted_line": formatted_task,
            }), 200
        except Exception as e:
            logger.error(f"Failed to add today task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/upcoming-tasks', methods=['GET'])
    def upcoming_tasks():
        tasks = obsidian.fetch_upcoming_tasks()
        serializable = {
            k: {f: v for f, v in t.items() if f != 'file_path'}
            for k, t in tasks.items()
        }
        return jsonify({"count": len(tasks), "tasks": serializable})

    @bp.route('/next-tasks', methods=['GET'])
    def next_tasks():
        tasks = obsidian.fetch_next_tasks()
        serializable = {
            k: {f: v for f, v in t.items() if f != 'file_path'}
            for k, t in tasks.items()
        }
        return jsonify({"count": len(tasks), "tasks": serializable})

    @bp.route('/task/complete', methods=['POST'])
    def complete_task_by_line():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        raw_line = data.get('raw_line')
        if not rel_path or not raw_line:
            return jsonify({"error": "rel_path and raw_line required"}), 400
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            new_task_line = obsidian.complete_task(file_path, raw_line)
            task_id = str(uuid.uuid4())
            undo_store[task_id] = {
                "task": {"file_path": file_path, "raw_line": raw_line},
                "new_task_line": new_task_line,
                "expires_at": time.time() + UNDO_WINDOW,
            }
            return jsonify({"status": "success", "task_id": task_id})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to complete task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/undo-complete/<task_id>', methods=['POST'])
    def undo_complete_task_by_line(task_id):
        entry = undo_store.pop(task_id, None)
        if not entry:
            return jsonify({"error": "Nothing to undo."}), 404
        if time.time() > entry["expires_at"]:
            return jsonify({"error": "Undo window expired."}), 410
        try:
            task = entry["task"]
            obsidian.undo_complete_task(task["file_path"], task["raw_line"], entry["new_task_line"])
            return jsonify({"status": "success"})
        except Exception as e:
            logger.error(f"Failed to undo task completion: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/delete', methods=['POST'])
    def delete_task():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        raw_line = data.get('raw_line')
        if not rel_path or not raw_line:
            return jsonify({"error": "rel_path and raw_line required"}), 400
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            obsidian.delete_task(file_path, raw_line)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to delete task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/move-to-file', methods=['POST'])
    def move_task_to_file():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        raw_line = data.get('raw_line')
        new_line = data.get('new_line') or raw_line
        target_path = (data.get('target_path') or '').strip()
        if not rel_path or not raw_line:
            return jsonify({"error": "rel_path and raw_line required"}), 400
        if not target_path:
            target_abs = obsidian.imploding_tasks_file
        else:
            if not target_path.endswith('.md'):
                target_path += '.md'
            target_abs = os.path.join(obsidian.vault_path, target_path)
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            obsidian.move_task_to_file(file_path, raw_line, new_line, target_abs)
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to move task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/inline-tasks', methods=['GET'])
    def inline_tasks():
        rel_path = request.args.get('rel_path')
        if not rel_path:
            return jsonify({"error": "rel_path required"}), 400
        file_path = os.path.join(obsidian.vault_path, rel_path)
        tasks = obsidian.fetch_inline_tasks(file_path)
        return jsonify({"tasks": tasks, "count": len(tasks)})

    @bp.route('/task/promote-inline', methods=['POST'])
    def promote_inline():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        raw_line = data.get('raw_line')
        if not rel_path or not raw_line:
            return jsonify({"error": "rel_path and raw_line required"}), 400
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            new_line = obsidian.promote_inline_task(file_path, raw_line)
            return jsonify({"status": "success", "new_line": new_line})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to promote inline task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/add-next', methods=['POST'])
    def add_next_task():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        description = (data.get('description') or '').strip()
        if not rel_path or not description:
            return jsonify({"error": "rel_path and description required"}), 400
        tags = [t for t in (data.get('tags') or []) if t not in ('#todo', '#next')]
        due = data.get('due') or ''
        scheduled = data.get('scheduled') or ''
        start = data.get('start') or ''
        time_val = data.get('time') or ''
        recur = data.get('recur') or ''
        parts = ['- [ ] #todo #next', description] + tags
        if due: parts.append(f"📅 {due}")
        if scheduled: parts.append(f"⏳ {scheduled}")
        if start: parts.append(f"🛫 {start}")
        if time_val: parts.append(f"@{time_val}")
        if recur: parts.append(f"🔁 {recur}")
        new_line = ' '.join(parts) + '\n'
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            obsidian.add_next_task(file_path, new_line)
            return jsonify({"status": "success"})
        except Exception as e:
            logger.error(f"Failed to add next task: {e}")
            return jsonify({"error": str(e)}), 500

    @bp.route('/task/update', methods=['POST'])
    def update_task():
        data = request.get_json() or {}
        rel_path = data.get('rel_path')
        raw_line = data.get('raw_line')
        new_line = data.get('new_line')
        if not rel_path or not raw_line or not new_line:
            return jsonify({"error": "rel_path, raw_line and new_line required"}), 400
        file_path = os.path.join(obsidian.vault_path, rel_path)
        try:
            obsidian.update_task(file_path, raw_line, new_line)
            for task in tasks_store.values():
                if task['raw_line'] == raw_line:
                    task['raw_line'] = new_line
                    task['task'] = new_line.strip()
                    break
            return jsonify({"status": "success"})
        except ValueError as e:
            return jsonify({"error": str(e)}), 404
        except Exception as e:
            logger.error(f"Failed to update task: {e}")
            return jsonify({"error": str(e)}), 500

    return bp
