import os


class ObsidianBase:
    IGNORE_DIRS = ['.obsidian', '.git', '.trash']

    def __init__(self, vault_path, ignore_dirs=None):
        self.vault_path = vault_path
        self.ignore_dirs = ignore_dirs or self.IGNORE_DIRS

    def _walk_md_files(self):
        for root, dirs, files in os.walk(self.vault_path):
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            for file in files:
                if file.endswith('.md'):
                    yield os.path.join(root, file)
