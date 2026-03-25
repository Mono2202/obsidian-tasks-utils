import threading
import dotenv
import os
import time
from datetime import datetime
from flask import Flask, jsonify
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
        
def main():
    daemon = threading.Thread(target=reminder_worker, daemon=True)
    daemon.start()

    app.run(host=os.getenv("HOST"), port=int(os.getenv("PORT")), debug=False)

if __name__ == '__main__':
    main()
