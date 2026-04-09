import re
import dotenv
import os
from datetime import datetime
from flask import Flask, jsonify, request, render_template, send_from_directory
from obsidian import Obsidian
from pushover import Pushover
from logger import get_logger
import reminder

FETCH_TASKS_INTERVAL = 30

app = Flask(__name__)

dotenv.load_dotenv()
obsidian = Obsidian(vault_path=os.getenv("OBSIDIAN_VAULT_PATH"))
pushover = Pushover(api_token=os.getenv("PUSHOVER_API_TOKEN"), user_key=os.getenv("PUSHOVER_USER_KEY"))

logger = get_logger(__name__)

tasks_store = {}
reminder.start(obsidian, pushover, tasks_store_ref={"store": tasks_store}, interval=FETCH_TASKS_INTERVAL)

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory('assets', filename)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/today-tasks', methods=['GET'])
def today_tasks_endpoint():
    global tasks_store
    tasks_store = obsidian.fetch_today_tasks()
    logger.info(f"Fetched {len(tasks_store)} tasks for today")
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks_store.items()}
    return jsonify({
        "count": len(tasks_store),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "tasks": serializable
    })

@app.route('/complete-task/<task_id>', methods=['POST'])
def complete_task_endpoint(task_id):
    task = tasks_store.get(task_id)
    if not task:
        return jsonify({"error": "Task not found. Refresh and try again."}), 404

    try:
        obsidian.complete_task(task["file_path"], task["raw_line"])
        del tasks_store[task_id]
        logger.info(f"Task completed: {task['task']}")
        return jsonify({"status": "success", "message": "Task marked as done"}), 200
    except Exception as e:
        logger.error(f"Failed to complete task {task_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/add-task', methods=['GET'])
def add_task_endpoint():
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
            "formatted_line": formatted_task
        }), 200

    except Exception as e:
        logger.error(f"Failed to add inbox task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/add-today-task', methods=['GET'])
def add_today_task_endpoint():
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
            "formatted_line": formatted_task
        }), 200
    except Exception as e:
        logger.error(f"Failed to add today task: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/upcoming-tasks', methods=['GET'])
def upcoming_tasks_endpoint():
    tasks = obsidian.fetch_upcoming_tasks()
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks.items()}
    return jsonify({"count": len(tasks), "tasks": serializable})

@app.route('/next-tasks', methods=['GET'])
def next_tasks_endpoint():
    tasks = obsidian.fetch_next_tasks()
    serializable = {k: {f: v for f, v in task.items() if f != "raw_line" and f != "file_path"} for k, task in tasks.items()}
    return jsonify({"count": len(tasks), "tasks": serializable})

def main():
    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
