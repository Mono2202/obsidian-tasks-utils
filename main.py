import threading
import dotenv
import os
import time
from datetime import datetime
from flask import Flask, jsonify, request
from obsidian import Obsidian
from pushover import Pushover

FETCH_TASKS_INTERVAL = 30

app = Flask(__name__)

dotenv.load_dotenv()
obsidian = Obsidian(vault_path=os.getenv("OBSIDIAN_VAULT_PATH"))
pushover = Pushover(api_token=os.getenv("PUSHOVER_API_TOKEN"), user_key=os.getenv("PUSHOVER_USER_KEY"))

def reminder_worker():
    print("Reminder background worker started...")
    last_reminded_time = ""

    while True:
        now = datetime.now()
        current_time_str = now.strftime("%H:%M")

        if current_time_str != last_reminded_time:
            tasks = obsidian.fetch_today_tasks()
            for task in tasks:
                if task["time"] == current_time_str:
                    pushover.send_message(message=task["task"].replace("- [ ] #todo", ""), title="Task Reminder")
            last_reminded_time = current_time_str

        time.sleep(FETCH_TASKS_INTERVAL)

@app.route('/today-tasks', methods=['GET'])
def today_tasks_endpoint():
    tasks = obsidian.fetch_today_tasks()
    return jsonify({
        "count": len(tasks),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "tasks": tasks
    })

@app.route('/add-task', methods=['GET'])
def add_task_endpoint():
    # Get the 'task' parameter from the URL
    task_description = request.args.get('task')
    
    if not task_description:
        return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400

    formatted_task = f"- [ ] #todo {task_description.strip()}"

    try:
        # Append to the file
        with open(obsidian.inbox_file, "a", encoding="utf-8") as f:
            f.write(f"{formatted_task}\n")
        
        print(f"✅ Task Added: {formatted_task}")
        
        return jsonify({
            "status": "success",
            "message": "Task appended to Inbox",
            "formatted_line": formatted_task
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/add-today-task', methods=['GET'])
def add_today_task_endpoint():
    task_description = request.args.get('task')
    time = request.args.get('time')

    if not task_description:
        return jsonify({"error": "No task description provided. Use ?task=your+task"}), 400

    if time and not __import__('re').match(r'^\d{2}:\d{2}$', time):
        return jsonify({"error": "Invalid time format. Use HH:MM"}), 400

    try:
        formatted_task = obsidian.add_task_to_daily_note(task_description, time)
        print(f"✅ Today Task Added: {formatted_task}")
        return jsonify({
            "status": "success",
            "message": "Task added to today's daily note",
            "formatted_line": formatted_task
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def main():
    daemon = threading.Thread(target=reminder_worker, daemon=True)
    daemon.start()

    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
