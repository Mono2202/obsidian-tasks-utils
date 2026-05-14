from __future__ import annotations

import os
import re
import time
from datetime import date
from pathlib import Path

import requests

from backend.music.spotify import SpotifyClient, TrackInfo, AlbumTrack, AlbumInfo

_INVALID_CHARS = re.compile(r'[\\/:*?"<>|]')
_RATING_CELL = re.compile(r'^\d+/10$')


def _sanitize(name: str) -> str:
    return _INVALID_CHARS.sub('-', name).strip()


class MusicWriter:
    def __init__(self, spotify: SpotifyClient):
        reviews_path = os.getenv("OBSIDIAN_REVIEWS_PATH", "")
        if not reviews_path:
            raise EnvironmentError("OBSIDIAN_REVIEWS_PATH is not set in .env")
        self._root = Path(reviews_path)
        if not self._root.exists():
            raise EnvironmentError(f"Reviews folder does not exist: {self._root}")

        assets_path = os.getenv("OBSIDIAN_ASSETS_PATH", "")
        if not assets_path:
            raise EnvironmentError("OBSIDIAN_ASSETS_PATH is not set in .env")
        self._assets = Path(assets_path)
        if not self._assets.exists():
            raise EnvironmentError(f"Assets folder does not exist: {self._assets}")

        self._spotify = spotify

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

    def _get_album_review(self, track: TrackInfo) -> tuple[int, str] | None:
        path = self._file_path(track)
        if not path.exists():
            return None

        content = path.read_text(encoding="utf-8")
        row = self._find_row(content, track.track_name)
        if row is None:
            return None

        cells = _parse_row(row)
        if len(cells) < 5:
            return None

        rating_cell = cells[2]
        notes_cell = cells[4]

        if not _RATING_CELL.match(rating_cell):
            return None

        try:
            rating = int(rating_cell.split("/")[0])
        except ValueError:
            return None

        notes = notes_cell.replace("<br><br>", "\n")
        return rating, notes

    def _get_song_review(self, track: TrackInfo) -> tuple[int, str] | None:
        path = self._song_file_path(track)
        if not path.exists():
            return None

        content = path.read_text(encoding="utf-8")
        rating_match = re.search(r'^rating:\s*(\d+)$', content, re.MULTILINE)
        if not rating_match:
            return None

        rating = int(rating_match.group(1))
        marker = "**Notes:**\n"
        idx = content.find(marker)
        notes = content[idx + len(marker):].strip() if idx != -1 else ""
        return rating, notes

    def _create_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        album_info = self._spotify.get_album_info(track.album_id)
        album_tracks = self._spotify.get_album_tracks(track.album_id)

        timestamp_ms = int(time.time() * 1000)
        cover_filename = f"{_sanitize(album_info.album_name)}-{timestamp_ms}.png"
        self._download_image(album_info.cover_url, self._assets / cover_filename)

        today = date.today().isoformat()
        content = self._build_content(
            album_info=album_info,
            album_tracks=album_tracks,
            cover_filename=cover_filename,
            today=today,
            review_name=track.track_name,
            rating=rating,
            notes=notes,
        )
        path.write_text(content, encoding="utf-8")

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
                row_rating = f"{rating}/10"
                row_notes = notes.replace("\n", "<br><br>")
            else:
                row_rating = ""
                row_notes = ""
            rows.append(_build_row([str(t.track_number), t.track_name, row_rating, "", row_notes]))

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
        raw = "\n".join(lines) + "\n"
        return _recalculate_rating(raw)

    def _update_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()
        notes_cell = notes.replace("\n", "<br><br>")
        rating_str = f"{rating}/10"

        for i, line in enumerate(lines):
            if not line.startswith("|"):
                continue
            cells = _parse_row(line)
            if len(cells) < 5:
                continue
            if cells[1] == track.track_name:
                cells[2] = rating_str
                cells[4] = notes_cell
                lines[i] = _build_row(cells)
                break

        updated = "\n".join(lines) + "\n"
        path.write_text(_recalculate_rating(updated), encoding="utf-8")

    # ------------------------------------------------------------------ #
    # Song mode (per-track files)
    # ------------------------------------------------------------------ #

    def _song_file_path(self, track: TrackInfo) -> Path:
        songs_dir = self._root / "songs"
        songs_dir.mkdir(exist_ok=True)
        return songs_dir / f"{_sanitize(track.track_name)}.md"

    def _create_song_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        # Reuse existing cover asset if already downloaded for this album
        cover_filename = f"{_sanitize(track.album_name)}.png"
        cover_path = self._assets / cover_filename
        if not cover_path.exists() and track.cover_url:
            self._download_image(track.cover_url, cover_path)

        content = self._build_song_content(track, cover_filename, date.today().isoformat(), rating, notes)
        path.write_text(content, encoding="utf-8")

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
            f"cover: {cover_filename}",
            "---",
            f"![[{cover_filename}|135]]",
            "",
            "**Notes:**",
            notes,
        ]
        return "\n".join(lines) + "\n"

    def _update_song_file(self, path: Path, track: TrackInfo, rating: int, notes: str) -> None:
        content = path.read_text(encoding="utf-8")
        content = re.sub(r'^rating:\s*\d+$', f'rating: {rating}', content, flags=re.MULTILINE)
        marker = "**Notes:**\n"
        idx = content.find(marker)
        if idx != -1:
            content = content[:idx + len(marker)] + notes + "\n"
        path.write_text(content, encoding="utf-8")

    # ------------------------------------------------------------------ #
    # Album mode (per-album files)
    # ------------------------------------------------------------------ #

    def _file_path(self, track: TrackInfo) -> Path:
        return self._root / f"{_sanitize(track.album_name)}.md"

    @staticmethod
    def _find_row(content: str, track_name: str) -> str | None:
        for line in content.splitlines():
            if not line.startswith("|"):
                continue
            cells = _parse_row(line)
            if len(cells) >= 2 and cells[1] == track_name:
                return line
        return None

    @staticmethod
    def _download_image(url: str, dest: Path) -> None:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        dest.write_bytes(response.content)


def _parse_row(line: str) -> list[str]:
    parts = line.split("|")
    return [p.strip() for p in parts[1:-1]]


def _build_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def _recalculate_rating(content: str) -> str:
    ratings: list[int] = []
    in_table = False

    for line in content.splitlines():
        if line.startswith("### Tracks"):
            in_table = True
            continue
        if in_table and line.startswith("|"):
            cells = _parse_row(line)
            if len(cells) >= 3 and _RATING_CELL.match(cells[2]):
                ratings.append(int(cells[2].split("/")[0]))

    if not ratings:
        return content

    avg = round(sum(ratings) / len(ratings), 2)
    return re.sub(r"^rating: .*$", f"rating: {avg:.2f}", content, flags=re.MULTILINE)
