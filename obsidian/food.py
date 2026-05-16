import os
import re
from datetime import datetime

from backend.logger import get_logger

logger = get_logger(__name__)

_HOME_MADE_DIR = "Home Made"
_RATING_RE = re.compile(r'\((\d+)/10\)')


def _slugify(text):
    return re.sub(r'[^\w\s-]', '', text).strip().replace(' ', '-')


class Food:
    def __init__(self, reviews_path: str, assets_path: str):
        self.reviews_path = reviews_path
        self.assets_path = assets_path

    def get_restaurants(self):
        if not self.reviews_path or not os.path.isdir(self.reviews_path):
            return []
        return sorted(
            e.name[:-3]
            for e in os.scandir(self.reviews_path)
            if e.is_file() and e.name.endswith('.md')
        )

    def save_review(self, mode, dish, rating, restaurant=None, cost=None, notes=None,
                    photo_bytes=None, photo_ext=None):
        if not self.reviews_path:
            raise ValueError("OBSIDIAN_FOOD_PATH is not configured")

        today = datetime.now().strftime("%Y-%m-%d")
        stars = "★" * rating + "☆" * (10 - rating)

        photo_name = None
        if photo_bytes and self.assets_path:
            os.makedirs(self.assets_path, exist_ok=True)
            slug = _slugify(dish)[:40]
            timestamp = datetime.now().strftime("%H%M%S")
            photo_name = f"{today}-{timestamp}-{slug}{photo_ext or '.jpg'}"
            with open(os.path.join(self.assets_path, photo_name), "wb") as f:
                f.write(photo_bytes)

        os.makedirs(self.reviews_path, exist_ok=True)

        if mode == "restaurant":
            return self._save_restaurant(today, dish, rating, stars, restaurant, cost, notes, photo_name)
        else:
            return self._save_homemade(today, dish, rating, stars, cost, notes, photo_name)

    def _save_restaurant(self, today, dish, rating, stars, restaurant, cost, notes, photo_name):
        filepath = os.path.join(self.reviews_path, f"{restaurant}.md")

        cost_cell = str(cost) if cost else "-"
        notes_cell = (notes or "-").replace("|", "\\|").replace("\n", " ")
        photo_cell = f"![[{photo_name}]]" if photo_name else "-"
        row = f"| {today} | {dish} | {stars} ({rating}/10) | {cost_cell} | {photo_cell} | {notes_cell} |"

        if os.path.exists(filepath):
            self._append_table_row(filepath, row)
            self._update_average(filepath)
        else:
            content = "\n".join([
                "---",
                f"average: {float(rating):.1f}",
                "---",
                "",
                "| Date | Dish | Rating | Cost | Photo | Notes |",
                "|------|------|--------|------|-------|-------|",
                row,
                "",
            ])
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)

        logger.info(f"Restaurant review saved: {filepath}")
        return f"{restaurant}.md"

    def _save_homemade(self, today, dish, rating, stars, cost, notes, photo_name):
        homemade_dir = os.path.join(self.reviews_path, _HOME_MADE_DIR)
        os.makedirs(homemade_dir, exist_ok=True)

        lines = [f"# {dish}", "",
                 f"**Date:** {today}",
                 f"**Rating:** {stars} ({rating}/10)"]
        if cost:
            lines.append(f"**Cost:** {cost}")
        if photo_name:
            lines += ["", f"![[{photo_name}]]"]
        if notes:
            lines += ["", "## Notes", "", notes]
        lines.append("")

        slug = _slugify(dish)[:50]
        filepath = os.path.join(homemade_dir, f"{today} {slug}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        logger.info(f"Home-made review saved: {filepath}")
        return os.path.basename(filepath)

    @staticmethod
    def _append_table_row(filepath, row):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.read().rstrip("\n").split("\n")

        last_table_idx = max(
            (i for i, l in enumerate(lines) if l.strip().startswith("|")),
            default=len(lines) - 1,
        )
        lines.insert(last_table_idx + 1, row)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    @staticmethod
    def _update_average(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        ratings = [int(m.group(1)) for m in _RATING_RE.finditer(content)]
        if not ratings:
            return

        avg = sum(ratings) / len(ratings)
        content = re.sub(r'^average: .*$', f'average: {avg:.1f}', content, flags=re.MULTILINE)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
