import os
import sqlite3
import time
from pathlib import Path

import pytest

from image_viewer.indexer import DirectoryIndexer


def create_file(path: Path, content: str = "data") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def test_initial_index_build(tmp_path: Path) -> None:
    create_file(tmp_path / "season1" / "episode1.mp4")
    create_file(tmp_path / "season1" / "episode2.mp4")
    create_file(tmp_path / "season2" / "episode1.mp4")

    index_path = tmp_path / "index.db"
    with DirectoryIndexer(tmp_path, index_path) as indexer:
        indexer.build_index(max_workers=2, batch_size=10)
        root_entries = indexer.list_directory(".")

    names = sorted(entry.path for entry in root_entries)
    assert names == ["season1", "season2"]

    with sqlite3.connect(index_path) as conn:
        count = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    # 1 root + 2 folders + 3 files = 6 entries
    assert count == 6


def test_incremental_updates(tmp_path: Path) -> None:
    season1 = tmp_path / "season1"
    episode1 = season1 / "episode1.mp4"
    create_file(episode1, "one")

    index_path = tmp_path / "index.db"
    with DirectoryIndexer(tmp_path, index_path) as indexer:
        indexer.build_index(max_workers=2, batch_size=4)

        time.sleep(1.1)  # ensure mtime resolution differences do not hide updates
        episode1.write_text("updated")
        create_file(season1 / "episode2.mp4", "two")
        (tmp_path / "orphan.txt").write_text("orphan")
        indexer.build_index(max_workers=2, batch_size=4)

        entries = {entry.path for entry in indexer.iter_all()}

    assert "." in entries
    assert "season1" in entries
    assert "season1/episode1.mp4" in entries
    assert "season1/episode2.mp4" in entries
    assert "orphan.txt" in entries
    # ensure deleted entries disappear
    (tmp_path / "orphan.txt").unlink()

    with DirectoryIndexer(tmp_path, index_path) as indexer:
        indexer.build_index(max_workers=2, batch_size=4)
        entries_after_delete = {entry.path for entry in indexer.iter_all()}

    assert "orphan.txt" not in entries_after_delete
