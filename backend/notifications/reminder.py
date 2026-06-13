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
    pushover.send_message(message="\n".join(lines), title=f"📋 Today's Tasks ({len(lines)})")
    logger.info(f"Daily task summary sent: {len(lines)} tasks")


def _send_habits_reminder(habits_obsidian, pushover):
    try:
        habits = habits_obsidian.fetch_habits()
    except Exception as e:
        logger.error(f"Failed to fetch habits for reminder: {e}")
        return
    pending = [h for h in habits if not h.get("done_today")]
    if not pending:
        logger.info("Habits reminder: all habits completed, skipping")
        return
    lines = [f"• {h['title']}" for h in pending]
    pushover.send_message(message="\n".join(lines), title=f"🌿 Pending Habits ({len(lines)})")
    logger.info(f"Habits reminder sent: {len(lines)} pending")


def _worker(obsidian, habits_obsidian, inbox_obsidian, pushover, tasks_store, interval,
            daily_summary_time, habits_reminder_time):
    logger.info("Reminder background worker started...")
    last_reminded_time = ""
    last_summary_date = ""
    last_habits_date = ""

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

            if inbox_obsidian:
                try:
                    for item in inbox_obsidian.fetch_inbox_items():
                        if item.get("time") == current_time_str and "#remind" in item.get("tags", []):
                            message = item["description"] or "Inbox item"
                            logger.info(f"Sending inbox remind: {message}")
                            pushover.send_message(message=message, title="📥 Inbox Reminder")
                except Exception as e:
                    logger.error(f"Inbox remind check failed: {e}")

            if (daily_summary_time
                    and current_time_str == daily_summary_time
                    and last_summary_date != today):
                _send_daily_summary(tasks_store, pushover)
                last_summary_date = today

            if (habits_reminder_time
                    and current_time_str == habits_reminder_time
                    and last_habits_date != today
                    and habits_obsidian):
                _send_habits_reminder(habits_obsidian, pushover)
                last_habits_date = today

            last_reminded_time = current_time_str

        time.sleep(interval)


def start(obsidian, habits_obsidian, inbox_obsidian, pushover, tasks_store, interval,
          daily_summary_time="", habits_reminder_time=""):
    daemon = threading.Thread(
        target=_worker,
        args=(obsidian, habits_obsidian, inbox_obsidian, pushover, tasks_store, interval,
              daily_summary_time, habits_reminder_time),
        daemon=True,
    )
    daemon.start()
