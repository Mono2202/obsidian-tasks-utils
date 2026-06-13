import os
import re
import uuid
from datetime import datetime

from backend.logger import get_logger
from .base import ObsidianBase

logger = get_logger(__name__)


class Inbox(ObsidianBase):
    TASK_PATTERN = re.compile(r"^\s*-\s\[ \].*#todo", re.MULTILINE)
    DUE_DATE_PATTERN = re.compile(r"📅\s*(\d{4}-\d{2}-\d{2})")
    SCHED_DATE_PATTERN = re.compile(r"⏳\s*(\d{4}-\d{2}-\d{2})")
    TIME_PATTERN = re.compile(r"@(\d{2}:\d{2})")
    START_DATE_PATTERN = re.compile(r"🛫\s*(\d{4}-\d{2}-\d{2})")
    RECUR_PATTERN = re.compile(r"🔁\s*(every 2 days|every week|every 2 weeks|every 3 weeks|every month)")
    TAG_PATTERN = re.compile(r"#(\S+)")

    def __init__(self, vault_path, inbox_path, imploding_tasks_path, archive_path=None, ignore_dirs=None):
        super().__init__(vault_path, ignore_dirs)
        self.inbox_file = inbox_path
        self.imploding_tasks_file = imploding_tasks_path
        self.archive_path = archive_path or ""

    def _parse_line(self, line, line_index):
        due_match = self.DUE_DATE_PATTERN.search(line)
        sched_match = self.SCHED_DATE_PATTERN.search(line)
        time_match = self.TIME_PATTERN.search(line)
        start_match = self.START_DATE_PATTERN.search(line)
        recur_match = self.RECUR_PATTERN.search(line)

        tags = [
            m.group(0) for m in self.TAG_PATTERN.finditer(line)
            if m.group(1) not in ('todo',)
        ]

        desc = line.strip()
        desc = re.sub(r"^-\s\[.\]\s*", "", desc)
        desc = re.sub(r"📅\s*\d{4}-\d{2}-\d{2}", "", desc)
        desc = re.sub(r"⏳\s*\d{4}-\d{2}-\d{2}", "", desc)
        desc = re.sub(r"🛫\s*\d{4}-\d{2}-\d{2}", "", desc)
        desc = re.sub(r"✅\s*\d{4}-\d{2}-\d{2}", "", desc)
        desc = re.sub(r"🔁\s*(every 2 days|every week|every 2 weeks|every 3 weeks|every month)", "", desc)
        desc = re.sub(r"@\d{2}:\d{2}", "", desc)
        desc = re.sub(r"#\S+", "", desc)
        desc = re.sub(r"\s+", " ", desc).strip()

        return {
            "id": str(uuid.uuid4()),
            "raw_line": line,
            "line_index": line_index,
            "description": desc,
            "tags": tags,
            "due": due_match.group(1) if due_match else None,
            "scheduled": sched_match.group(1) if sched_match else None,
            "start": start_match.group(1) if start_match else None,
            "time": time_match.group(1) if time_match else None,
            "recur": recur_match.group(1) if recur_match else None,
        }

    def fetch_inbox_items(self):
        try:
            with open(self.inbox_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except FileNotFoundError:
            return []

        items = []
        for i, line in enumerate(lines):
            if self.TASK_PATTERN.search(line):
                items.append(self._parse_line(line, i))

        logger.info(f"Fetched {len(items)} inbox items")
        return items

    def _read_inbox(self):
        with open(self.inbox_file, "r", encoding="utf-8") as f:
            return f.read()

    def _write_inbox(self, content):
        with open(self.inbox_file, "w", encoding="utf-8") as f:
            f.write(content)

    def update_inbox_item(self, raw_line, new_line):
        content = self._read_inbox()
        if raw_line not in content:
            raise ValueError("Task not found in inbox")
        content = content.replace(raw_line, new_line, 1)
        self._write_inbox(content)
        logger.info(f"Updated inbox item: {raw_line.strip()} → {new_line.strip()}")

    def delete_inbox_item(self, raw_line):
        content = self._read_inbox()
        if raw_line not in content:
            raise ValueError("Task not found in inbox")
        content = content.replace(raw_line, "", 1)
        self._write_inbox(content)
        logger.info(f"Deleted inbox item: {raw_line.strip()}")

    def move_to_file(self, raw_line, line_to_write, target_abs_path):
        self.delete_inbox_item(raw_line)
        dir_path = os.path.dirname(target_abs_path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)
        line = line_to_write if line_to_write.endswith("\n") else line_to_write + "\n"
        with open(target_abs_path, "a", encoding="utf-8") as f:
            f.write(line)
        logger.info(f"Moved inbox item to {target_abs_path}: {line.strip()}")

    def complete_inbox_item(self, raw_line):
        today = datetime.now().strftime("%Y-%m-%d")
        completed = raw_line.rstrip("\n").replace("- [ ]", "- [x]", 1) + f" ✅ {today}\n"
        self.delete_inbox_item(raw_line)
        with open(self.imploding_tasks_file, "a", encoding="utf-8") as f:
            f.write(completed)
        logger.info(f"Completed inbox item: {raw_line.strip()}")

    def add_inbox_item(self, description):
        line = f"- [ ] #todo {description.strip()}\n"
        with open(self.inbox_file, "a", encoding="utf-8") as f:
            f.write(line)
        logger.info(f"Added inbox item: {line.strip()}")
        return line

    def list_vault_files(self):
        archive_rel = (
            os.path.relpath(self.archive_path, self.vault_path).replace(os.sep, "/")
            if self.archive_path else ""
        )
        files = []
        for path in self._walk_md_files():
            rel = os.path.relpath(path, self.vault_path).replace(os.sep, "/")
            if any(part.startswith(".") for part in rel.split("/")):
                continue
            if archive_rel and (rel == archive_rel or rel.startswith(archive_rel + "/")):
                continue
            files.append(rel)
        return sorted(files)
