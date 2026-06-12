import re
import time
import threading
from datetime import datetime
from backend.logger import get_logger

logger = get_logger(__name__)

_CLEAN_RE = [
    (re.compile(r'^-\s*\[.\]\s*'), ''),
    (re.compile(r'#[^\s]+\s*'), ''),
    (re.compile(r'📅\s*\d{4}-\d{2}-\d{2}'), ''),
    (re.compile(r'⏳\s*\d{4}-\d{2}-\d{2}'), ''),
    (re.compile(r'🛫\s*\d{4}-\d{2}-\d{2}'), ''),
    (re.compile(r'✅\s*\d{4}-\d{2}-\d{2}'), ''),
    (re.compile(r'🔁[^📅⏳🛫✅]*'), ''),
    (re.compile(r'[⏫🔼🔽]'), ''),
    (re.compile(r'@\d{2}:\d{2}'), ''),
]

def _clean(text):
    for pattern, repl in _CLEAN_RE:
        text = pattern.sub(repl, text)
    return text.strip()


def _send_daily_summary(tasks_store, pushover):
    tasks = list(tasks_store.values())
    if not tasks:
        return
    lines = [f"• {_clean(t['task'])}" for t in tasks]
    count = len(lines)
    message = "\n".join(lines)
    pushover.send_message(message=message, title=f"📋 Today's Tasks ({count})")
    logger.info(f"Daily summary sent: {count} tasks")


def _worker(obsidian, pushover, tasks_store, interval, daily_summary_time):
    logger.info("Reminder background worker started...")
    last_reminded_time = ""
    last_summary_date = ""

    while True:
        now = datetime.now()
        current_time_str = now.strftime("%H:%M")
        today = now.strftime("%Y-%m-%d")

        if current_time_str != last_reminded_time:
            new_tasks = obsidian.fetch_today_tasks()
            tasks_store.clear()
            tasks_store.update(new_tasks)

            for task in tasks_store.values():
                message = _clean(task["task"])
                if task["time"] == current_time_str:
                    logger.info(f"Sending reminder: {message}")
                    pushover.send_message(message=message, title="Task Reminder")
                elif current_time_str == "10:00" and task.get("start") == today:
                    logger.info(f"Sending start notification: {message}")
                    pushover.send_message(message=message, title="Task Starting Today")

            if (daily_summary_time
                    and current_time_str == daily_summary_time
                    and last_summary_date != today):
                _send_daily_summary(tasks_store, pushover)
                last_summary_date = today

            last_reminded_time = current_time_str

        time.sleep(interval)


def start(obsidian, pushover, tasks_store, interval, daily_summary_time=""):
    daemon = threading.Thread(
        target=_worker,
        args=(obsidian, pushover, tasks_store, interval, daily_summary_time),
        daemon=True,
    )
    daemon.start()
