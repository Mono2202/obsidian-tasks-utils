import os
import re
from datetime import datetime

from backend.logger import get_logger

logger = get_logger(__name__)


def _slugify(text):
    return re.sub(r'[^\w\s-]', '', text).strip().replace(' ', '-')


class Food:
    def __init__(self, reviews_path: str, assets_path: str):
        self.reviews_path = reviews_path
        self.assets_path = assets_path

    def save_review(self, mode, dish, rating, restaurant=None, cost=None, notes=None,
                    photo_bytes=None, photo_ext=None):
        if not self.reviews_path:
            raise ValueError("OBSIDIAN_FOOD_PATH is not configured")

        today = datetime.now().strftime("%Y-%m-%d")
        stars = "★" * rating + "☆" * (5 - rating)

        photo_name = None
        if photo_bytes and self.assets_path:
            os.makedirs(self.assets_path, exist_ok=True)
            photo_name = f"{today}-{_slugify(dish)[:40]}{photo_ext or '.jpg'}"
            with open(os.path.join(self.assets_path, photo_name), "wb") as f:
                f.write(photo_bytes)

        if mode == "restaurant" and restaurant:
            title = f"{dish} — {restaurant}"
            type_line = f"**Restaurant:** {restaurant}"
        else:
            title = dish
            type_line = "**Type:** Home-made"

        lines = [f"# {title}", "",
                 f"**Date:** {today}", type_line,
                 f"**Rating:** {stars} ({rating}/5)"]
        if cost:
            lines.append(f"**Cost:** {cost}")
        if photo_name:
            lines += ["", f"![[{photo_name}]]"]
        if notes:
            lines += ["", "## Notes", "", notes]
        lines.append("")

        os.makedirs(self.reviews_path, exist_ok=True)
        slug = _slugify(title)[:50]
        filepath = os.path.join(self.reviews_path, f"{today} {slug}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        logger.info(f"Food review saved: {filepath}")
        return os.path.basename(filepath)
