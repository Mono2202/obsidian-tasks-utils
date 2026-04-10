import os
import re
import uuid
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from logger import get_logger

logger = get_logger(__name__)

class Obsidian:
    TASK_PATTERN = re.compile(r"^\s*-\s\[ \].*#todo", re.MULTILINE)
    NEXT_TASK_PATTERN = re.compile(r"^\s*-\s\[ \].*#todo.*#next", re.MULTILINE)
    DUE_DATE_PATTERN = re.compile(r"📅\s*(\d{4}-\d{2}-\d{2})")
    SCHED_DATE_PATTERN = re.compile(r"⏳\s*(\d{4}-\d{2}-\d{2})")
    TIME_PATTERN = re.compile(r"(?:@(\d{2}:\d{2})|(\d{2}:\d{2})@)")
    START_DATE_PATTERN = re.compile(r"🛫\s*(\d{4}-\d{2}-\d{2})")
    RECUR_PATTERN = re.compile(r"🔁\s*(every week|every 2 weeks|every 3 weeks|every month)")
    ANY_RECUR_PATTERN = re.compile(r"🔁")

    RECUR_DELTAS = {
        "every week":    lambda: timedelta(weeks=1),
        "every 2 weeks": lambda: timedelta(weeks=2),
        "every 3 weeks": lambda: timedelta(weeks=3),
        "every month":   lambda: relativedelta(months=1),
    }

    def __init__(self, vault_path, ignore_dirs=None):
        self.vault_path = vault_path
        self.inbox_file = os.path.join(vault_path, "Areas", "GTD", "Inbox.md")
        self.imploding_tasks_file = os.path.join(vault_path, "Areas", "GTD", "IMPLODING TASKS.md")
        self.habits_dir = os.path.join(vault_path, "Areas", "Habits")
        self.ignore_dirs = ignore_dirs if ignore_dirs else ['.obsidian', '.git', '.trash']

    def fetch_today_tasks(self):
        today = datetime.now().strftime("%Y-%m-%d")
        today_tasks = {}

        for root, dirs, files in os.walk(self.vault_path):
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            for file in files:
                if file.endswith(".md"):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.readlines()
                            for line in content:
                                if self.TASK_PATTERN.search(line):
                                    due_match = self.DUE_DATE_PATTERN.search(line)
                                    sched_match = self.SCHED_DATE_PATTERN.search(line)
                                    time_match = self.TIME_PATTERN.search(line)
                                    start_match = self.START_DATE_PATTERN.search(line)

                                    due_date = due_match.group(1) if due_match else None
                                    sched_date = sched_match.group(1) if sched_match else None
                                    task_time = time_match.group(1) if time_match else None
                                    start_date = start_match.group(1) if start_match else None

                                    is_due_today_or_before = due_date and due_date <= today
                                    is_sched_today_or_before = sched_date and sched_date <= today
                                    is_starting_today = start_date and start_date <= today

                                    if is_due_today_or_before or is_sched_today_or_before or is_starting_today:
                                        rel_path = os.path.relpath(file_path, self.vault_path)
                                        top_folder = rel_path.split(os.sep)[0]
                                        task_id = str(uuid.uuid4())
                                        has_recur = self.ANY_RECUR_PATTERN.search(line)
                                        has_supported_recur = self.RECUR_PATTERN.search(line)
                                        completable = not has_recur or bool(has_supported_recur)
                                        today_tasks[task_id] = {
                                            "task": line.strip(),
                                            "file": file,
                                            "file_path": file_path,
                                            "top_folder": top_folder,
                                            "due": due_date,
                                            "scheduled": sched_date,
                                            "start": start_date,
                                            "time": task_time,
                                            "raw_line": line,
                                            "completable": completable,
                                        }

                    except Exception as e:
                        logger.error(f"Error reading {file_path}: {e}")

        logger.info(f"Fetched {len(today_tasks)} tasks for today from vault")
        return today_tasks

    def complete_task(self, file_path, raw_line):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        if raw_line not in content:
            logger.error(f"Task line not found in {file_path}: {raw_line.strip()}")
            raise ValueError("Task line not found in file")

        today = datetime.now().strftime("%Y-%m-%d")
        completed_line = raw_line.rstrip("\n").replace("- [ ]", "- [x]", 1) + f" ✅ {today}\n"

        recur_match = self.RECUR_PATTERN.search(raw_line)
        if recur_match:
            recur_key = recur_match.group(1)
            delta = self.RECUR_DELTAS[recur_key]()

            # Find the scheduled or due date to advance
            sched_match = self.SCHED_DATE_PATTERN.search(raw_line)
            due_match = self.DUE_DATE_PATTERN.search(raw_line)
            if sched_match:
                old_date_str = sched_match.group(1)
                old_date = datetime.strptime(old_date_str, "%Y-%m-%d")
                new_date_str = (old_date + delta).strftime("%Y-%m-%d")
                new_task_line = raw_line.replace(f"⏳ {old_date_str}", f"⏳ {new_date_str}\n", 1)
            elif due_match:
                old_date_str = due_match.group(1)
                old_date = datetime.strptime(old_date_str, "%Y-%m-%d")
                new_date_str = (old_date + delta).strftime("%Y-%m-%d")
                new_task_line = raw_line.replace(f"📅 {old_date_str}", f"📅 {new_date_str}\n", 1)
            else:
                new_task_line = None

            if new_task_line:
                content = content.replace(raw_line, new_task_line + completed_line, 1)
                logger.info(f"Recurring task rescheduled to {new_date_str}: {raw_line.strip()}")
            else:
                content = content.replace(raw_line, completed_line, 1)
        else:
            content = content.replace(raw_line, completed_line, 1)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info(f"Task completed in {file_path}: {raw_line.strip()}")

    def add_task_to_today(self, task_description, time=None):
        today = datetime.now().strftime("%Y-%m-%d")
        time_part = f" @{time}" if time else ""
        formatted_task = f"- [ ] #todo {task_description.strip()}{time_part} 📅 {today}"

        with open(self.imploding_tasks_file, "a", encoding="utf-8") as f:
            f.write(f"{formatted_task}\n")
        logger.info(f"Task added to today: {formatted_task}")

        return formatted_task

    def fetch_next_tasks(self):
        next_tasks = {}

        for root, dirs, files in os.walk(self.vault_path):
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            for file in files:
                if file.endswith(".md"):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            for line in f.readlines():
                                if self.NEXT_TASK_PATTERN.search(line):
                                    rel_path = os.path.relpath(file_path, self.vault_path)
                                    top_folder = rel_path.split(os.sep)[0]
                                    task_id = str(uuid.uuid4())
                                    next_tasks[task_id] = {
                                        "task": line.strip(),
                                        "file": file,
                                        "file_path": file_path,
                                        "top_folder": top_folder,
                                        "raw_line": line,
                                    }
                    except Exception as e:
                        logger.error(f"Error reading {file_path}: {e}")

        logger.info(f"Fetched {len(next_tasks)} #next tasks from vault")
        return next_tasks

    def fetch_upcoming_tasks(self):
        today = datetime.now()
        today_str = today.strftime("%Y-%m-%d")
        cutoff_str = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        upcoming_tasks = {}

        for root, dirs, files in os.walk(self.vault_path):
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            for file in files:
                if file.endswith(".md"):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            for line in f.readlines():
                                if not self.TASK_PATTERN.search(line):
                                    continue
                                if self.ANY_RECUR_PATTERN.search(line):
                                    continue

                                due_match = self.DUE_DATE_PATTERN.search(line)
                                sched_match = self.SCHED_DATE_PATTERN.search(line)
                                due_date = due_match.group(1) if due_match else None
                                sched_date = sched_match.group(1) if sched_match else None

                                due_upcoming = due_date and today_str < due_date <= cutoff_str
                                sched_upcoming = sched_date and today_str < sched_date <= cutoff_str

                                if due_upcoming or sched_upcoming:
                                    rel_path = os.path.relpath(file_path, self.vault_path)
                                    top_folder = rel_path.split(os.sep)[0]
                                    task_id = str(uuid.uuid4())
                                    happens = due_date if due_upcoming else sched_date
                                    upcoming_tasks[task_id] = {
                                        "task": line.strip(),
                                        "file": file,
                                        "file_path": file_path,
                                        "top_folder": top_folder,
                                        "due": due_date,
                                        "scheduled": sched_date,
                                        "happens": happens,
                                        "raw_line": line,
                                    }
                    except Exception as e:
                        logger.error(f"Error reading {file_path}: {e}")

        logger.info(f"Fetched {len(upcoming_tasks)} upcoming tasks from vault")
        return upcoming_tasks

    def fetch_habits(self):
        today = datetime.now().strftime("%Y-%m-%d")
        habits = []

        if not os.path.isdir(self.habits_dir):
            return habits

        for file in sorted(os.listdir(self.habits_dir)):
            if not file.endswith(".md"):
                continue
            file_path = os.path.join(self.habits_dir, file)
            name = file[:-3]
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                title_match = re.search(r"^title:\s*(.+)$", content, re.MULTILINE)
                title = title_match.group(1).strip() if title_match else name
                entries = re.findall(r"^\s*-\s+(\d{4}-\d{2}-\d{2})\s*$", content, re.MULTILINE)
                done_today = today in entries
                habits.append({"name": name, "title": title, "done_today": done_today, "entries": entries})
            except Exception as e:
                logger.error(f"Error reading habit {file_path}: {e}")

        logger.info(f"Fetched {len(habits)} habits")
        return habits

    def complete_habit(self, name):
        today = datetime.now().strftime("%Y-%m-%d")
        file_path = os.path.join(self.habits_dir, f"{name}.md")

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        entries = re.findall(r"^\s*-\s+(\d{4}-\d{2}-\d{2})\s*$", content, re.MULTILINE)
        if today in entries:
            raise ValueError("Habit already completed today")

        # Find the last date entry under the entries: key and insert after it,
        # or insert on the next line after entries: if the list is empty.
        last_entry_match = None
        for m in re.finditer(r"^\s*-\s+\d{4}-\d{2}-\d{2}\s*$", content, re.MULTILINE):
            last_entry_match = m

        if last_entry_match:
            insert_pos = last_entry_match.end()
        else:
            entries_match = re.search(r"^entries:.*$", content, re.MULTILINE)
            if not entries_match:
                raise ValueError("No 'entries:' key found in habit file")
            insert_pos = entries_match.end()

        content = content[:insert_pos] + f"\n  - {today}" + content[insert_pos:]

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Habit '{name}' completed for {today}")
