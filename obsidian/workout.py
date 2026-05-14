import os
import re
from datetime import date, timedelta

from backend.logger import get_logger
from .base import ObsidianBase

logger = get_logger(__name__)


class Workout(ObsidianBase):
    _EXERCISE_RE = re.compile(r'^- .+ :: \d+x\d+')
    _EXERCISE_PARSE_RE = re.compile(r'^- (.+?) :: (\d+)x(\d+)(?: @ (.+))?$')

    def __init__(self, vault_path, daily_notes_dir, ignore_dirs=None):
        super().__init__(vault_path, ignore_dirs)
        self._daily_notes_dir = daily_notes_dir

    def _daily_note_path(self, date_str):
        return os.path.join(self._daily_notes_dir, f"{date_str}.md")

    def _parse_workout_section(self, content):
        exercises = []
        in_section = False
        for line in content.split('\n'):
            stripped = line.strip()
            if stripped == '## Workout':
                in_section = True
                continue
            if in_section:
                if stripped.startswith('## ') and stripped != '## Workout':
                    break
                m = self._EXERCISE_PARSE_RE.match(stripped)
                if m:
                    exercises.append({
                        'name': m.group(1).strip(),
                        'sets': int(m.group(2)),
                        'reps': int(m.group(3)),
                        'weight': m.group(4).strip() if m.group(4) else None,
                    })
        return exercises

    def fetch_workout(self, date_str):
        path = self._daily_note_path(date_str)
        if not os.path.exists(path):
            return []
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return self._parse_workout_section(content)

    def add_exercise(self, date_str, name, sets, reps, weight=None):
        path = self._daily_note_path(date_str)
        weight_part = f" @ {weight}" if weight else ""
        new_line = f"- {name} :: {sets}x{reps}{weight_part}\n"

        if not os.path.exists(path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(f"# {date_str}\n\n## Workout\n{new_line}")
            return

        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        workout_idx = None
        last_exercise_idx = None
        in_workout = False
        for i, line in enumerate(lines):
            if line.strip() == '## Workout':
                workout_idx = i
                in_workout = True
            elif in_workout:
                if line.startswith('## '):
                    break
                if self._EXERCISE_RE.match(line.strip()):
                    last_exercise_idx = i

        if workout_idx is not None:
            insert_at = (last_exercise_idx + 1) if last_exercise_idx is not None else (workout_idx + 1)
            lines.insert(insert_at, new_line)
        else:
            if lines and not lines[-1].endswith('\n'):
                lines[-1] += '\n'
            lines.append(f"## Workout\n{new_line}")

        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        logger.info(f"Exercise added to {date_str}: {new_line.strip()}")

    def delete_exercise(self, date_str, index):
        path = self._daily_note_path(date_str)
        if not os.path.exists(path):
            raise ValueError("Daily note not found")

        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        in_workout = False
        exercise_line_indices = []
        for i, line in enumerate(lines):
            if line.strip() == '## Workout':
                in_workout = True
            elif in_workout:
                if line.startswith('## '):
                    break
                if self._EXERCISE_RE.match(line.strip()):
                    exercise_line_indices.append(i)

        if index >= len(exercise_line_indices):
            raise ValueError("Exercise index out of range")

        del lines[exercise_line_indices[index]]

        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        logger.info(f"Exercise {index} deleted from {date_str}")

    def fetch_workout_history(self, days=14):
        history = []
        today = date.today()
        for i in range(1, days + 1):
            d = today - timedelta(days=i)
            date_str = d.strftime('%Y-%m-%d')
            exercises = self.fetch_workout(date_str)
            if exercises:
                history.append({'date': date_str, 'exercises': exercises})
        return history

    def fetch_exercise_suggestions(self, days=60):
        seen = {}
        today = date.today()
        for i in range(days, -1, -1):
            d = today - timedelta(days=i)
            for ex in self.fetch_workout(d.strftime('%Y-%m-%d')):
                seen[ex['name']] = ex
        return sorted(seen.values(), key=lambda x: x['name'].lower())
