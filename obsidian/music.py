from __future__ import annotations

import re
import time
from datetime import date
from pathlib import Path

import requests

from backend.logger import get_logger
from backend.music.spotify import SpotifyClient, TrackInfo, AlbumTrack, AlbumInfo

logger = get_logger(__name__)

_INVALID_CHARS = re.compile(r'[\\/:*?"<>|]')
_RATING_CELL = re.compile(r'^[★☆]+ \(\d+/10\)$')
_RATING_VALUE = re.compile(r'\((\d+)/10\)')


class Music:
    def __init__(self, spotify: SpotifyClient, reviews_path: str, assets_path: str):
        self._root = Path(reviews_path)
        if not self._root.exists():
            raise EnvironmentError(f"Reviews folder does not exist: {self._root}")

        self._assets = Path(assets_path)
        if not self._assets.exists():
            raise EnvironmentError(f"Assets folder does not exist: {self._assets}")

        self._spotify = spotify

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def migrate_rating_format(self) -> int:
        _old = re.compile(r'^(\d+)/10$')
        changed = 0
        for path in self._root.rglob("*.md"):
            content = path.read_text(encoding="utf-8")
            lines = content.splitlines()
            modified = False
            for i, line in enumerate(lines):
                if not line.startswith("|"):
                    continue
                cells = self._parse_row(line)
                if len(cells) < 3:
                    continue
                m = _old.match(cells[2])
                if not m:
                    continue
                rating = int(m.group(1))
                cells[2] = f"{self._stars(rating)} ({rating}/10)"
                lines[i] = self._build_row(cells)
                modified = True
            if modified:
                path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                logger.info(f"Migrated: {path.name}")
                changed += 1
        return changed

    def upsert_review(self, track: TrackInfo, rating: int, notes: str, album_mode: bool = True) -> None:
        if album_mode:
            path = self._file_path(track)
            if not path.exists():
                self._create_file(path, track, rating, notes)
            else:
                self._update_file(path, track, rating, notes)
        else:
            path = self._song_file_path(track)
            if not path.exists():
                self._create_song_file(path, track, rating, notes)
            else:
                self._update_song_file(path, track, rating, notes)

    def get_existing_review(self, track: TrackInfo, album_mode: bool = True) -> tuple[int, str] | None:
        if album_mode:
            return self._get_album_review(track)
        return self._get_song_review(track)

    # ------------------------------------------------------------------ #
    # Album mode
    # ------------------------------------------------------------------ #

    def _get_album_review(self, track: TrackInfo) -> tuple[int, str] | None:
        path = self._file_path(track)
        if not path.exists():
            return None
        content = path.read_text(encoding="utf-8")
        row = self._find_row(content, track.track_name)
        if row is None:
            return None
        cells = self._parse_row(row)
        if len(cells) < 5 or not _RATING_CELL.match(cells[2]):
            return None
        m = _RATING_VALUE.search(cells[2])
        if not m:
            return None
        rating = int(m.group(1))
        notes = cells[4].replace("<br><br>", "\n")
        return rating, notes

    def _create_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        album_info = self._spotify.get_album_info(track.album_id)
        album_tracks = self._spotify.get_album_tracks(track.album_id)
        timestamp_ms = int(time.time() * 1000)
        cover_filename = f"{self._sanitize(album_info.album_name)}-{timestamp_ms}.png"
        self._download_image(album_info.cover_url, self._assets / cover_filename)
        content = self._build_content(
            album_info=album_info,
            album_tracks=album_tracks,
            cover_filename=cover_filename,
            today=date.today().isoformat(),
            review_name=track.track_name,
            rating=rating,
            notes=notes,
        )
        path.write_text(content, encoding="utf-8")
        logger.info(f"Created album review: {track.album_name}")

    def _build_content(
        self,
        album_info: AlbumInfo,
        album_tracks: list[AlbumTrack],
        cover_filename: str,
        today: str,
        review_name: str,
        rating: int,
        notes: str,
    ) -> str:
        rows = []
        for t in album_tracks:
            if t.track_name == review_name:
                row_rating = f"{self._stars(rating)} ({rating}/10)"
                row_notes = notes.replace("\n", "<br><br>")
            else:
                row_rating = ""
                row_notes = ""
            rows.append(self._build_row([str(t.track_number), t.track_name, row_rating, "", row_notes]))
        lines = [
            "---",
            f"artist: {album_info.artist}",
            "music_genre:",
            f"release: {album_info.release_year}",
            f"date: {today}",
            "rating: 0.00",
            f"cover: {cover_filename}",
            "---",
            f"![[{cover_filename}|135]]",
            "",
            "### Tracks",
            "| No. | Track | Rating | Symbol | Notes |",
            "| --- | ----- | ------ | ------ | ----- |",
            *rows,
        ]
        return self._recalculate_rating("\n".join(lines) + "\n")

    def _update_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()
        notes_cell = notes.replace("\n", "<br><br>")
        rating_str = f"{self._stars(rating)} ({rating}/10)"
        for i, line in enumerate(lines):
            if not line.startswith("|"):
                continue
            cells = self._parse_row(line)
            if len(cells) < 5:
                continue
            if cells[1] == track.track_name:
                cells[2] = rating_str
                cells[4] = notes_cell
                lines[i] = self._build_row(cells)
                break
        path.write_text(self._recalculate_rating("\n".join(lines) + "\n"), encoding="utf-8")
        logger.info(f"Updated album review: {track.album_name} — {track.track_name} ({rating}/10)")

    def _file_path(self, track: TrackInfo) -> Path:
        return self._root / f"{self._sanitize(track.album_name)}.md"

    # ------------------------------------------------------------------ #
    # Song mode
    # ------------------------------------------------------------------ #

    def _get_song_review(self, track: TrackInfo) -> tuple[int, str] | None:
        path = self._song_file_path(track)
        if not path.exists():
            return None
        content = path.read_text(encoding="utf-8")
        rating_match = re.search(r'^rating:\s*(\d+)$', content, re.MULTILINE)
        if not rating_match:
            return None
        rating = int(rating_match.group(1))
        marker = "## Notes\n"
        idx = content.find(marker)
        notes = content[idx + len(marker):].strip() if idx != -1 else ""
        return rating, notes

    def _create_song_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        cover_filename = f"{self._sanitize(track.album_name)}.png"
        cover_path = self._assets / cover_filename
        if not cover_path.exists() and track.cover_url:
            self._download_image(track.cover_url, cover_path)
        content = self._build_song_content(track, cover_filename, date.today().isoformat(), rating, notes)
        path.write_text(content, encoding="utf-8")
        logger.info(f"Created song review: {track.track_name}")

    def _build_song_content(
        self, track: TrackInfo, cover_filename: str, today: str, rating: int, notes: str
    ) -> str:
        lines = [
            "---",
            f"track: {track.track_name}",
            f"artist: {track.artist}",
            f"album: {track.album_name}",
            f"release: {track.release_year}",
            f"date: {today}",
            f"rating: {rating}",
            f"stars: {self._stars(rating)}",
            f"cover: {cover_filename}",
            "---",
            f"![[{cover_filename}|135]]",
            "",
            "## Notes",
            notes,
        ]
        return "\n".join(lines) + "\n"

    def _update_song_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        content = path.read_text(encoding="utf-8")
        content = re.sub(r'^rating:\s*\d+$', f'rating: {rating}', content, flags=re.MULTILINE)
        content = re.sub(r'^stars: [★☆]+$', f'stars: {self._stars(rating)}', content, flags=re.MULTILINE)
        marker = "## Notes\n"
        idx = content.find(marker)
        if idx != -1:
            content = content[:idx + len(marker)] + notes + "\n"
        path.write_text(content, encoding="utf-8")
        logger.info(f"Updated song review: {track.track_name} ({rating}/10)")

    def _song_file_path(self, track: TrackInfo) -> Path:
        songs_dir = self._root / "Singles"
        songs_dir.mkdir(exist_ok=True)
        return songs_dir / f"{self._sanitize(track.track_name)}.md"

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _stars(rating: int) -> str:
        return "★" * rating + "☆" * (10 - rating)

    @staticmethod
    def _sanitize(name: str) -> str:
        return _INVALID_CHARS.sub('-', name).strip()

    @staticmethod
    def _parse_row(line: str) -> list[str]:
        parts = line.split("|")
        return [p.strip() for p in parts[1:-1]]

    @staticmethod
    def _build_row(cells: list[str]) -> str:
        return "| " + " | ".join(cells) + " |"

    @staticmethod
    def _recalculate_rating(content: str) -> str:
        ratings: list[int] = []
        in_table = False
        for line in content.splitlines():
            if line.startswith("### Tracks"):
                in_table = True
                continue
            if in_table and line.startswith("|"):
                cells = Music._parse_row(line)
                if len(cells) >= 3 and _RATING_CELL.match(cells[2]):
                    m = _RATING_VALUE.search(cells[2])
                    if m:
                        ratings.append(int(m.group(1)))
        if not ratings:
            return content
        avg = round(sum(ratings) / len(ratings), 2)
        return re.sub(r"^rating: .*$", f"rating: {avg:.2f}", content, flags=re.MULTILINE)

    @staticmethod
    def _find_row(content: str, track_name: str) -> str | None:
        for line in content.splitlines():
            if not line.startswith("|"):
                continue
            cells = Music._parse_row(line)
            if len(cells) >= 2 and cells[1] == track_name:
                return line
        return None

    @staticmethod
    def _download_image(url: str, dest: Path) -> None:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        dest.write_bytes(response.content)
