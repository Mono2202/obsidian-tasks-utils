import time
import threading
from datetime import datetime
from logger import get_logger

logger = get_logger(__name__)

def _worker(obsidian, pushover, tasks_store_ref, interval):
    logger.info("Reminder background worker started...")
    last_reminded_time = ""

    while True:
        now = datetime.now()
        current_time_str = now.strftime("%H:%M")

        if current_time_str != last_reminded_time:
            today = now.strftime("%Y-%m-%d")
            tasks_store_ref["store"] = obsidian.fetch_today_tasks()
            for task in tasks_store_ref["store"].values():
                message = task["task"].replace("- [ ] #todo", "").strip()
                if task["time"] == current_time_str:
                    logger.info(f"Sending reminder: {message}")
                    pushover.send_message(message=message, title="Task Reminder")
                elif current_time_str == "10:00" and task.get("start") == today:
                    logger.info(f"Sending start notification: {message}")
                    pushover.send_message(message=message, title="Task Starting Today")
            last_reminded_time = current_time_str

        time.sleep(interval)

def start(obsidian, pushover, tasks_store_ref, interval):
    daemon = threading.Thread(target=_worker, args=(obsidian, pushover, tasks_store_ref, interval), daemon=True)
    daemon.start()
