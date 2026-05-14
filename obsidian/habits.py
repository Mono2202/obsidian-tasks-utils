import os
import re
from datetime import date, datetime, timedelta

from backend.logger import get_logger
from .base import ObsidianBase

logger = get_logger(__name__)


class Habits(ObsidianBase):
    def __init__(self, vault_path, habits_dir, ignore_dirs=None):
        super().__init__(vault_path, ignore_dirs)
        self.habits_dir = habits_dir

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
                desc_match = re.search(r"^description:\s*(.+)$", content, re.MULTILINE)
                description = desc_match.group(1).strip().strip("\"'") if desc_match else None
                entries = re.findall(r"^\s*-\s+(\d{4}-\d{2}-\d{2})\s*$", content, re.MULTILINE)
                done_today = today in entries
                max_gap_match = re.search(r"^maxGap:\s*(\d+)$", content, re.MULTILINE)
                max_gap = int(max_gap_match.group(1)) if max_gap_match else 0
                streak = self._calculate_streak(entries, max_gap)
                habits.append({
                    "name": name,
                    "title": title,
                    "description": description,
                    "done_today": done_today,
                    "streak": streak,
                    "entries": entries,
                })
            except Exception as e:
                logger.error(f"Error reading habit {file_path}: {e}")

        logger.info(f"Fetched {len(habits)} habits")
        return habits

    def _calculate_streak(self, entries, max_gap=0):
        if not entries:
            return 0
        dates = sorted(set(entries), reverse=True)
        today = date.today()
        days_since_last = (today - date.fromisoformat(dates[0])).days
        if days_since_last > max_gap + 1:
            return 0
        streak = 1
        for i in range(1, len(dates)):
            gap = (date.fromisoformat(dates[i - 1]) - date.fromisoformat(dates[i])).days
            if gap <= max_gap + 1:
                streak += 1
            else:
                break
        return streak

    def complete_habit(self, name):
        today = datetime.now().strftime("%Y-%m-%d")
        file_path = os.path.join(self.habits_dir, f"{name}.md")

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        entries = re.findall(r"^\s*-\s+(\d{4}-\d{2}-\d{2})\s*$", content, re.MULTILINE)
        if today in entries:
            raise ValueError("Habit already completed today")

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

    def uncomplete_habit(self, name):
        today = datetime.now().strftime("%Y-%m-%d")
        file_path = os.path.join(self.habits_dir, f"{name}.md")

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        entries = re.findall(r"^\s*-\s+(\d{4}-\d{2}-\d{2})\s*$", content, re.MULTILINE)
        if today not in entries:
            raise ValueError("Habit not completed today")

        content = re.sub(
            r"^\s*-\s+" + re.escape(today) + r"\s*\n?", "", content, count=1, flags=re.MULTILINE
        )

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Habit '{name}' uncompleted for {today}")
