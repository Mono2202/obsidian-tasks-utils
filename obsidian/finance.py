import calendar
import os
import re
from datetime import datetime, date

from backend.logger import get_logger

logger = get_logger(__name__)

CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Housing', 'Utilities', 'Other']


class Finance:
    def __init__(self, finance_path: str, subscriptions_path: str = ""):
        self.finance_path = finance_path
        self.subscriptions_path = subscriptions_path

    # ── Public API ────────────────────────────────────────────────────────────

    def get_entries(self, month: str) -> list:
        try:
            self._apply_subscriptions(month)
        except Exception as e:
            logger.error(f"Failed to apply subscriptions for {month}: {e}")
        filepath = self._filepath(month)
        if not os.path.exists(filepath):
            return []
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return self._parse_entries(content)

    def get_subscriptions(self) -> list:
        if not self.subscriptions_path or not os.path.exists(self.subscriptions_path):
            return []
        with open(self.subscriptions_path, 'r', encoding='utf-8') as f:
            content = f.read()
        subs = []
        for line in content.splitlines():
            s = line.strip()
            if not s.startswith('|'):
                continue
            if re.match(r'^\|[-| ]+\|', s) or re.match(r'^\|\s*Name\s*\|', s):
                continue
            parts = [p.strip() for p in s.split('|')[1:-1]]
            if len(parts) < 4:
                continue
            try:
                subs.append({
                    'name': parts[0],
                    'category': parts[1],
                    'amount': float(parts[2]),
                    'day': int(parts[3]),
                })
            except (ValueError, IndexError):
                continue
        return subs

    def add_entry(self, month: str, title: str, category: str, amount: float) -> None:
        if not self.finance_path:
            raise ValueError("OBSIDIAN_FINANCE_PATH is not configured")
        os.makedirs(self.finance_path, exist_ok=True)
        today = datetime.now().strftime("%Y-%m-%d")
        safe_title = title.replace('|', '\\|')
        row = f"| {today} | {safe_title} | {category} | {amount:.2f} |"
        filepath = self._filepath(month)
        if os.path.exists(filepath):
            self._append_row(filepath, row)
        else:
            content = "\n".join([
                "| Date | Title | Category | Amount |",
                "|------|-------|----------|--------|",
                row,
                "",
            ])
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
        logger.info(f"Finance entry added: {title} {amount:.2f} ({category})")

    def delete_entry(self, month: str, index: int) -> None:
        filepath = self._filepath(month)
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        data_rows = [(i, l) for i, l in enumerate(lines) if self._is_data_row(l)]
        if index < 0 or index >= len(data_rows):
            raise IndexError("Entry index out of range")
        lines.pop(data_rows[index][0])
        with open(filepath, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        logger.info(f"Finance entry {index} deleted from {month}")

    # ── Subscription application ──────────────────────────────────────────────

    def _apply_subscriptions(self, month: str) -> None:
        subs = self.get_subscriptions()
        if not subs:
            return

        today = datetime.now().date()
        y, m = int(month[:4]), int(month[5:7])
        month_start = date(y, m, 1)
        current_month_start = today.replace(day=1)

        if month_start > current_month_start:
            return  # never pre-fill future months

        os.makedirs(self.finance_path, exist_ok=True)
        filepath = self._filepath(month)
        content = ""
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

        applied = self._get_applied_set(content)

        last_day = calendar.monthrange(y, m)[1]
        to_add = []
        for sub in subs:
            if sub['name'] in applied:
                continue
            if month_start == current_month_start and today.day < sub['day']:
                continue  # not yet due this month
            day = min(sub['day'], last_day)
            entry_date = f"{month}-{day:02d}"
            to_add.append((entry_date, sub))

        if not to_add:
            return

        rows = [
            f"| {entry_date} | {sub['name']} | {sub['category']} | {sub['amount']:.2f} |"
            for entry_date, sub in to_add
        ]

        if content.strip():
            lines = content.rstrip('\n').split('\n')
            last_table_idx = max(
                (i for i, l in enumerate(lines) if l.strip().startswith('|')),
                default=len(lines) - 1,
            )
            for row in rows:
                lines.insert(last_table_idx + 1, row)
                last_table_idx += 1
            content = '\n'.join(lines) + '\n'
        else:
            content = '\n'.join([
                "| Date | Title | Category | Amount |",
                "|------|-------|----------|--------|",
                *rows,
                "",
            ])

        new_applied = applied | {sub['name'] for _, sub in to_add}
        content = self._set_applied_set(content, new_applied)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        logger.info(f"Applied {len(to_add)} subscriptions to {month}")

    @staticmethod
    def _get_applied_set(content: str) -> set:
        m = re.search(r'^subscriptions_applied:\s*(.+)$', content, re.MULTILINE)
        if not m or not m.group(1).strip():
            return set()
        return {s.strip() for s in m.group(1).split(',') if s.strip()}

    @staticmethod
    def _set_applied_set(content: str, applied: set) -> str:
        value = ', '.join(sorted(applied))
        new_line = f"subscriptions_applied: {value}"
        fm = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
        if fm:
            fm_body = fm.group(1)
            if re.search(r'^subscriptions_applied:', fm_body, re.MULTILINE):
                fm_body = re.sub(r'^subscriptions_applied:.*$', new_line, fm_body, flags=re.MULTILINE)
            else:
                fm_body = fm_body + '\n' + new_line
            return f"---\n{fm_body}\n---\n{content[fm.end():]}"
        return f"---\n{new_line}\n---\n{content}"

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _filepath(self, month: str) -> str:
        return os.path.join(self.finance_path, f"{month}.md")

    @staticmethod
    def _is_data_row(line: str) -> bool:
        s = line.strip()
        if not s.startswith('|'):
            return False
        if re.match(r'^\|[-| ]+\|', s):
            return False
        if re.match(r'^\|\s*Date\s*\|', s):
            return False
        return True

    @staticmethod
    def _parse_entries(content: str) -> list:
        entries = []
        for line in content.splitlines():
            if not Finance._is_data_row(line):
                continue
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) < 4:
                continue
            try:
                entries.append({
                    'date': parts[0],
                    'title': parts[1],
                    'category': parts[2],
                    'amount': float(parts[3]),
                })
            except (ValueError, IndexError):
                continue
        return entries

    @staticmethod
    def _append_row(filepath: str, row: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.read().rstrip('\n').split('\n')
        last_table_idx = max(
            (i for i, l in enumerate(lines) if l.strip().startswith('|')),
            default=len(lines) - 1,
        )
        lines.insert(last_table_idx + 1, row)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
