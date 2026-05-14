import os

from .tasks import Tasks
from .habits import Habits
from .workout import Workout
from .music import Music


class Vault:
    def __init__(self, vault_path, spotify=None, ignore_dirs=None):
        def abspath(rel):
            return os.path.join(vault_path, rel) if rel else ""

        daily_folder = os.getenv("OBSIDIAN_DAILY_PATH", "")

        self.tasks = Tasks(
            vault_path,
            inbox_path=abspath(os.getenv("OBSIDIAN_INBOX_PATH", "")),
            today_path=abspath(os.getenv("OBSIDIAN_TODAY_PATH", "")),
            ignore_dirs=ignore_dirs,
        )
        self.habits = Habits(
            vault_path,
            habits_dir=abspath(os.getenv("OBSIDIAN_HABITS_PATH", "")),
            ignore_dirs=ignore_dirs,
        )
        self.workout = Workout(
            vault_path,
            daily_notes_dir=abspath(daily_folder) if daily_folder else vault_path,
            ignore_dirs=ignore_dirs,
        )
        self.music = Music(
            spotify,
            reviews_path=abspath(os.getenv("OBSIDIAN_REVIEWS_PATH", "")),
            assets_path=abspath(os.getenv("OBSIDIAN_ASSETS_PATH", "")),
        ) if spotify else None
