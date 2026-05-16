"""
One-time migration: converts old `x/10` rating cells in album review tables
to the new `★★★★★★★★☆☆ (x/10)` format.

Run from the project root:
    python utils/migrate_music_ratings.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dotenv
dotenv.load_dotenv()

from obsidian.music import Music

vault_path = os.getenv("OBSIDIAN_VAULT_PATH", "")
reviews_rel = os.getenv("OBSIDIAN_REVIEWS_PATH", "")
assets_rel  = os.getenv("OBSIDIAN_ASSETS_PATH", "")

reviews_path = os.path.join(vault_path, reviews_rel)
assets_path  = os.path.join(vault_path, assets_rel)

music = Music(spotify=None, reviews_path=reviews_path, assets_path=assets_path)
changed = music.migrate_rating_format()
print(f"Done — {changed} file(s) updated.")
