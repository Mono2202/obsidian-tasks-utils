import os
import re
from datetime import datetime

class Obsidian:
    TASK_PATTERN = re.compile(r"^\s*-\s\[ \].*#todo", re.MULTILINE)
    DUE_DATE_PATTERN = re.compile(r"📅\s*(\d{4}-\d{2}-\d{2})")
    SCHED_DATE_PATTERN = re.compile(r"⏳\s*(\d{4}-\d{2}-\d{2})")
    TIME_PATTERN = re.compile(r"(?:@(\d{2}:\d{2})|(\d{2}:\d{2})@)")

    def __init__(self, vault_path, ignore_dirs=None):
        self.vault_path = vault_path
        self.inbox_file = os.path.join(vault_path, "Areas", "GTD", "Inbox.md")
        self.imploding_tasks_file = os.path.join(vault_path, "Areas", "GTD", "IMPLODING TASKS.md")
        self.ignore_dirs = ignore_dirs if ignore_dirs else ['.obsidian', '.git', '.trash']

    def fetch_today_tasks(self):
        today = datetime.now().strftime("%Y-%m-%d")
        today_tasks = []

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

                                    due_date = due_match.group(1) if due_match else None
                                    sched_date = sched_match.group(1) if sched_match else None
                                    task_time = time_match.group(1) if time_match else None

                                    is_due_today_or_before = due_date and due_date <= today
                                    is_sched_today_or_before = sched_date and sched_date <= today

                                    if is_due_today_or_before or is_sched_today_or_before:
                                        today_tasks.append({
                                            "task": line.strip(),
                                            "file": file,
                                            "due": due_date,
                                            "scheduled": sched_date,
                                            "time": task_time
                                        })

                    except Exception as e:
                        print(f"Error reading {file_path}: {e}")

        return today_tasks

    def add_task_to_today(self, task_description, time=None):
        today = datetime.now().strftime("%Y-%m-%d")
        formatted_task = f"- [ ] #todo {task_description.strip()} 📅{today}"
        if time:
            formatted_task += f" @{time}"

        with open(self.imploding_tasks_file, "a", encoding="utf-8") as f:
            f.write(f"{formatted_task}\n")

        return formatted_task
