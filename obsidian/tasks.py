import os
import re
import uuid
from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta

from backend.logger import get_logger
from .base import ObsidianBase

logger = get_logger(__name__)


class Tasks(ObsidianBase):
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

    def __init__(self, vault_path, inbox_path, today_path, ignore_dirs=None):
        super().__init__(vault_path, ignore_dirs)
        self.inbox_file = inbox_path
        self.imploding_tasks_file = today_path

    def fetch_today_tasks(self):
        today = datetime.now().strftime("%Y-%m-%d")
        today_tasks = {}

        for file_path in self._walk_md_files():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for line in f.readlines():
                        if not self.TASK_PATTERN.search(line):
                            continue
                        due_match = self.DUE_DATE_PATTERN.search(line)
                        sched_match = self.SCHED_DATE_PATTERN.search(line)
                        time_match = self.TIME_PATTERN.search(line)
                        start_match = self.START_DATE_PATTERN.search(line)

                        due_date = due_match.group(1) if due_match else None
                        sched_date = sched_match.group(1) if sched_match else None
                        task_time = time_match.group(1) if time_match else None
                        start_date = start_match.group(1) if start_match else None

                        if not (
                            (due_date and due_date <= today)
                            or (sched_date and sched_date <= today)
                            or (start_date and start_date <= today)
                        ):
                            continue

                        rel_path = os.path.relpath(file_path, self.vault_path)
                        top_folder = rel_path.split(os.sep)[0]
                        task_id = str(uuid.uuid4())
                        has_recur = self.ANY_RECUR_PATTERN.search(line)
                        has_supported_recur = self.RECUR_PATTERN.search(line)
                        completable = not has_recur or bool(has_supported_recur)
                        today_tasks[task_id] = {
                            "task": line.strip(),
                            "file": os.path.basename(file_path),
                            "file_path": file_path,
                            "rel_path": rel_path.replace(os.sep, '/'),
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

            sched_match = self.SCHED_DATE_PATTERN.search(raw_line)
            due_match = self.DUE_DATE_PATTERN.search(raw_line)
            if sched_match:
                old_date_str = sched_match.group(1)
                new_date_str = (datetime.strptime(old_date_str, "%Y-%m-%d") + delta).strftime("%Y-%m-%d")
                new_task_line = raw_line.replace(f"⏳ {old_date_str}", f"⏳ {new_date_str}\n", 1)
            elif due_match:
                old_date_str = due_match.group(1)
                new_date_str = (datetime.strptime(old_date_str, "%Y-%m-%d") + delta).strftime("%Y-%m-%d")
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

        for file_path in self._walk_md_files():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for line in f.readlines():
                        if not self.NEXT_TASK_PATTERN.search(line):
                            continue
                        rel_path = os.path.relpath(file_path, self.vault_path)
                        top_folder = rel_path.split(os.sep)[0]
                        task_id = str(uuid.uuid4())
                        next_tasks[task_id] = {
                            "task": line.strip(),
                            "file": os.path.basename(file_path),
                            "file_path": file_path,
                            "rel_path": rel_path.replace(os.sep, '/'),
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

        for file_path in self._walk_md_files():
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

                        if not (due_upcoming or sched_upcoming):
                            continue

                        rel_path = os.path.relpath(file_path, self.vault_path)
                        top_folder = rel_path.split(os.sep)[0]
                        task_id = str(uuid.uuid4())
                        happens = due_date if due_upcoming else sched_date
                        upcoming_tasks[task_id] = {
                            "task": line.strip(),
                            "file": os.path.basename(file_path),
                            "file_path": file_path,
                            "rel_path": rel_path.replace(os.sep, '/'),
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
