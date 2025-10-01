"""Directory indexing utilities for the ImageViewer project.

The module provides a :class:`DirectoryIndexer` that can crawl a very large
folder structure and persist a lightweight index to an SQLite database. The
index makes it possible to open huge media libraries (multiple terabytes) much
faster on subsequent runs because the expensive IO bound directory walk only
needs to happen once or when files change.
"""

from __future__ import annotations

import argparse
import logging
import os
import queue
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional, Sequence, Tuple

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class IndexEntry:
    """A single file or directory stored in the index."""

    path: str
    parent: str
    is_dir: bool
    size: Optional[int]
    mtime: float


class DirectoryIndexer:
    """Incrementally maintain a filesystem index using SQLite.

    Parameters
    ----------
    root_path:
        Root directory whose contents should be indexed.
    db_path:
        Location of the SQLite database file that stores the index.
    follow_symlinks:
        Whether to follow symbolic links while crawling. The default is
        ``False`` to avoid infinite recursion when links create cycles.
    """

    def __init__(
        self,
        root_path: os.PathLike[str] | str,
        db_path: os.PathLike[str] | str,
        *,
        follow_symlinks: bool = False,
    ) -> None:
        self.root_path = Path(root_path).resolve()
        self.db_path = Path(db_path).resolve()
        self.follow_symlinks = follow_symlinks
        wal = self.db_path.with_name(f"{self.db_path.name}-wal")
        shm = self.db_path.with_name(f"{self.db_path.name}-shm")
        self._ignored_files = {
            self.db_path.resolve(),
            wal.resolve(),
            shm.resolve(),
        }
        self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA temp_store=MEMORY")
        self._conn.execute("PRAGMA locking_mode=NORMAL")
        self._db_lock = threading.Lock()
        self._ensure_schema()
        LOGGER.debug("Indexer initialized for %s", self.root_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def build_index(self, *, max_workers: Optional[int] = None, batch_size: int = 512) -> None:
        """Crawl the filesystem and update the on-disk index.

        The method is safe to call repeatedly. On subsequent runs only new or
        modified entries are written and files that no longer exist are
        removed from the index. The heavy scanning work is split between worker
        threads so that huge directory trees (e.g. > 2TB) can be processed
        efficiently.

        Parameters
        ----------
        max_workers:
            Number of worker threads used for directory traversal. If omitted
            the value is derived from ``os.cpu_count()``.
        batch_size:
            Number of :class:`IndexEntry` records to buffer before flushing them
            to the SQLite database. Larger batch sizes reduce commit overhead at
            the cost of memory usage.
        """

        max_workers = max_workers or max(os.cpu_count() or 1, 4)
        batch_size = max(batch_size, 32)

        self._reset_seen_flags()
        self._upsert_entries([self._create_root_entry()])

        dir_queue: "queue.Queue[tuple[Path, str]]" = queue.Queue()
        result_queue: "queue.Queue[Sequence[IndexEntry] | object]" = queue.Queue()
        sentinel = object()

        def worker() -> None:
            while True:
                item = dir_queue.get()
                try:
                    if item is sentinel:
                        return
                    abs_path, rel_path = item
                    entries, sub_dirs = self._scan_directory(abs_path, rel_path)
                    if entries:
                        result_queue.put(entries)
                    for child_abs, child_rel in sub_dirs:
                        dir_queue.put((child_abs, child_rel))
                finally:
                    dir_queue.task_done()

        def writer() -> None:
            buffer: List[IndexEntry] = []
            while True:
                item = result_queue.get()
                try:
                    if item is sentinel:
                        break
                    buffer.extend(item)
                    if len(buffer) >= batch_size:
                        self._upsert_entries(buffer)
                        buffer.clear()
                finally:
                    result_queue.task_done()
            if buffer:
                self._upsert_entries(buffer)

        workers = [threading.Thread(target=worker, daemon=True) for _ in range(max_workers)]
        for thread in workers:
            thread.start()

        writer_thread = threading.Thread(target=writer, daemon=True)
        writer_thread.start()

        dir_queue.put((self.root_path, "."))

        dir_queue.join()
        result_queue.join()

        result_queue.put(sentinel)
        writer_thread.join()

        for _ in workers:
            dir_queue.put(sentinel)
        for thread in workers:
            thread.join()

        self._remove_unseen_entries()
        LOGGER.info("Index rebuild complete for %s", self.root_path)

    def list_directory(self, relative_path: str = ".") -> List[IndexEntry]:
        """Return directory contents from the index.

        Parameters
        ----------
        relative_path:
            Relative path inside the indexed root, for example ``"."`` for the
            root itself or ``"season1"`` for a nested folder.
        """

        with self._db_lock:
            cur = self._conn.execute(
                """
                SELECT path, parent, is_dir, size, mtime
                FROM entries
                WHERE parent = ?
                ORDER BY is_dir DESC, path
                """,
                (relative_path,),
            )
            rows = cur.fetchall()
        return [
            IndexEntry(path=row[0], parent=row[1], is_dir=bool(row[2]), size=row[3], mtime=row[4])
            for row in rows
        ]

    def iter_all(self) -> Iterator[IndexEntry]:
        """Iterate over every entry stored in the index."""

        with self._db_lock:
            cur = self._conn.execute(
                "SELECT path, parent, is_dir, size, mtime FROM entries ORDER BY path"
            )
            rows = cur.fetchall()
        for row in rows:
            yield IndexEntry(path=row[0], parent=row[1], is_dir=bool(row[2]), size=row[3], mtime=row[4])

    def close(self) -> None:
        """Close the underlying SQLite connection."""

        if self._conn is not None:
            self._conn.close()

    def __enter__(self) -> "DirectoryIndexer":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_schema(self) -> None:
        with self._db_lock:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS entries (
                    path TEXT PRIMARY KEY,
                    parent TEXT,
                    is_dir INTEGER NOT NULL,
                    size INTEGER,
                    mtime REAL NOT NULL,
                    seen INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_entries_parent ON entries(parent)"
            )

    def _reset_seen_flags(self) -> None:
        with self._db_lock:
            self._conn.execute("UPDATE entries SET seen = 0")
            self._conn.commit()

    def _remove_unseen_entries(self) -> None:
        with self._db_lock:
            self._conn.execute("DELETE FROM entries WHERE seen = 0")
            self._conn.commit()

    def _upsert_entries(self, entries: Sequence[IndexEntry]) -> None:
        if not entries:
            return
        rows = [
            (
                entry.path,
                entry.parent,
                1 if entry.is_dir else 0,
                entry.size,
                entry.mtime,
            )
            for entry in entries
        ]
        with self._db_lock:
            self._conn.executemany(
                """
                INSERT INTO entries(path, parent, is_dir, size, mtime, seen)
                VALUES(?, ?, ?, ?, ?, 1)
                ON CONFLICT(path) DO UPDATE SET
                    parent = excluded.parent,
                    is_dir = excluded.is_dir,
                    size = excluded.size,
                    mtime = excluded.mtime,
                    seen = 1
                """,
                rows,
            )
            self._conn.commit()

    def _create_root_entry(self) -> IndexEntry:
        stat_info = self.root_path.stat()
        return IndexEntry(path=".", parent="", is_dir=True, size=None, mtime=stat_info.st_mtime)

    def _scan_directory(self, abs_path: Path, rel_path: str) -> Tuple[List[IndexEntry], List[Tuple[Path, str]]]:
        entries: List[IndexEntry] = []
        directories: List[Tuple[Path, str]] = []
        try:
            with os.scandir(abs_path) as iterator:
                for dir_entry in iterator:
                    entry_path = Path(dir_entry.path)
                    if entry_path.resolve() in self._ignored_files:
                        continue
                    if dir_entry.is_symlink() and not self.follow_symlinks:
                        continue
                    try:
                        stat_info = dir_entry.stat(follow_symlinks=self.follow_symlinks)
                    except (FileNotFoundError, PermissionError, OSError) as error:
                        LOGGER.warning("Cannot stat %s: %s", dir_entry.path, error)
                        continue
                    is_directory = dir_entry.is_dir(follow_symlinks=self.follow_symlinks)
                    relative_child = self._to_relative(Path(dir_entry.path))
                    entry = IndexEntry(
                        path=relative_child,
                        parent=rel_path,
                        is_dir=is_directory,
                        size=None if is_directory else stat_info.st_size,
                        mtime=stat_info.st_mtime,
                    )
                    entries.append(entry)
                    if is_directory:
                        directories.append((Path(dir_entry.path), relative_child))
        except (FileNotFoundError, PermissionError) as error:
            LOGGER.warning("Cannot access %s: %s", abs_path, error)
        return entries, directories

    def _to_relative(self, path: Path) -> str:
        try:
            relative = path.resolve().relative_to(self.root_path)
        except ValueError:
            # When a path escapes the root (for example a symlink that points
            # outside) fall back to absolute representation so we do not lose
            # the information.
            return path.resolve().as_posix()
        if not relative.parts:
            return "."
        return relative.as_posix()


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build an SQLite index for large media libraries")
    parser.add_argument("root", type=Path, help="Root directory to index")
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("media_index.db"),
        help="Location for the generated SQLite database (default: media_index.db)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Number of worker threads (defaults to number of logical CPUs)",
    )
    parser.add_argument(
        "--follow-symlinks",
        action="store_true",
        help="Follow symbolic links while indexing",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=512,
        help="Number of entries to buffer before writing to disk",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"],
        help="Logging level to use while indexing",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(level=getattr(logging, args.log_level))

    with DirectoryIndexer(args.root, args.database, follow_symlinks=args.follow_symlinks) as indexer:
        indexer.build_index(max_workers=args.workers, batch_size=args.batch_size)
    LOGGER.info("Index written to %s", args.database)
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
