"""ImageViewer 项目的目录索引工具。

该模块提供 :class:`DirectoryIndexer`，可用于遍历超大的目录结构，并将轻量级索引持久化到 SQLite 数据库中。借助该索引，在后续运行时无需
再次进行耗时的 IO 密集型目录扫描，就能快速打开容量高达数 TB 的媒体库。
"""

from __future__ import annotations

import argparse
import logging
import os
import queue
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Sequence, Set, Tuple

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class IndexEntry:
    """索引中存储的单个文件或目录条目。"""

    path: str
    parent: str
    is_dir: bool
    size: Optional[int]
    mtime: float


@dataclass(slots=True)
class TagSummary:
    """自动生成的目录标签概览。"""

    name: str
    display_name: str
    match_count: int


class DirectoryIndexer:
    """利用 SQLite 增量维护文件系统索引。

    Parameters
    ----------
    root_path:
        需要建立索引的根目录。
    db_path:
        存储索引的 SQLite 数据库文件路径。
    follow_symlinks:
        是否在遍历时跟随符号链接。默认为 ``False``，以避免符号链接形成循环时产生无限递归。
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
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._db_lock = threading.Lock()
        self._ensure_schema()
        LOGGER.debug("索引器已初始化：%s", self.root_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def build_index(
        self,
        *,
        max_workers: Optional[int] = None,
        batch_size: int = 512,
        min_tag_frequency: int = 2,
    ) -> None:
        """遍历文件系统并更新磁盘上的索引。

        该方法可以反复调用。再次执行时，只会写入新增或已修改的条目，并移除已不存在的文件。繁重的扫描工作会分配给多个工作线程，因而
        能够高效处理超大的目录树（例如超过 2TB）。

        Parameters
        ----------
        max_workers:
            遍历目录时使用的工作线程数量。若未指定，则根据 ``os.cpu_count()`` 推导。
        batch_size:
            在批量写入 SQLite 之前缓冲的 :class:`IndexEntry` 条目数量。批量越大，提交开销越小，但内存占用越高。
        """

        max_workers = max_workers or max(os.cpu_count() or 1, 4)
        batch_size = max(batch_size, 32)
        min_tag_frequency = max(1, min_tag_frequency)

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
        self._rebuild_tags(min_tag_frequency=min_tag_frequency)
        LOGGER.info("%s 的索引构建完成", self.root_path)

    def list_directory(self, relative_path: str = ".") -> List[IndexEntry]:
        """从索引中返回指定目录的内容。

        Parameters
        ----------
        relative_path:
            位于索引根目录下的相对路径，例如 ``"."`` 表示根目录，``"season1"`` 表示某个子目录。
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
        """遍历索引中存储的所有条目。"""

        with self._db_lock:
            cur = self._conn.execute(
                "SELECT path, parent, is_dir, size, mtime FROM entries ORDER BY path"
            )
            rows = cur.fetchall()
        for row in rows:
            yield IndexEntry(path=row[0], parent=row[1], is_dir=bool(row[2]), size=row[3], mtime=row[4])

    def list_tags(self) -> List[TagSummary]:
        """返回自动生成的标签及其匹配数量。"""

        with self._db_lock:
            cur = self._conn.execute(
                """
                SELECT tags.name, tags.display_name, COUNT(entry_tags.entry_path) as count
                FROM tags
                JOIN entry_tags ON entry_tags.tag_name = tags.name
                GROUP BY tags.name, tags.display_name
                ORDER BY count DESC, tags.display_name
                """
            )
            rows = cur.fetchall()
        return [TagSummary(name=row[0], display_name=row[1], match_count=row[2]) for row in rows]

    def list_directories_by_tag(self, tag_name: str) -> List[IndexEntry]:
        """返回与指定标签匹配的目录。"""

        with self._db_lock:
            cur = self._conn.execute(
                """
                SELECT e.path, e.parent, e.is_dir, e.size, e.mtime
                FROM entries e
                JOIN entry_tags et ON et.entry_path = e.path
                WHERE et.tag_name = ?
                ORDER BY e.path
                """,
                (tag_name,),
            )
            rows = cur.fetchall()
        return [
            IndexEntry(path=row[0], parent=row[1], is_dir=bool(row[2]), size=row[3], mtime=row[4])
            for row in rows
        ]

    def close(self) -> None:
        """关闭底层 SQLite 连接。"""

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
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tags (
                    name TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS entry_tags (
                    entry_path TEXT NOT NULL,
                    tag_name TEXT NOT NULL,
                    PRIMARY KEY (entry_path, tag_name),
                    FOREIGN KEY (entry_path) REFERENCES entries(path) ON DELETE CASCADE,
                    FOREIGN KEY (tag_name) REFERENCES tags(name) ON DELETE CASCADE
                )
                """
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag_name)"
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
                        LOGGER.warning("无法读取 %s 的元数据：%s", dir_entry.path, error)
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
            LOGGER.warning("无法访问 %s：%s", abs_path, error)
        return entries, directories

    def _to_relative(self, path: Path) -> str:
        try:
            relative = path.resolve().relative_to(self.root_path)
        except ValueError:
            # 当路径超出根目录（例如符号链接指向外部）时，退回到绝对路径表示，以免丢失信息。
            return path.resolve().as_posix()
        if not relative.parts:
            return "."
        return relative.as_posix()

    def _rebuild_tags(self, *, min_tag_frequency: int) -> None:
        directories: List[str]
        with self._db_lock:
            cur = self._conn.execute("SELECT path FROM entries WHERE is_dir = 1")
            directories = [row[0] for row in cur.fetchall()]

        token_map: Dict[str, Set[str]] = {}
        for directory in directories:
            if directory == ".":
                continue
            folder_name = Path(directory).name
            tokens = self._tokenize(folder_name)
            for token in tokens:
                token_map.setdefault(token, set()).add(directory)

        filtered = {token: paths for token, paths in token_map.items() if len(paths) >= min_tag_frequency}

        with self._db_lock:
            self._conn.execute("DELETE FROM entry_tags")
            self._conn.execute("DELETE FROM tags")

            if filtered:
                ordered_tokens = sorted(filtered.keys())
                tag_rows = [
                    (token, self._format_tag_display(token))
                    for token in ordered_tokens
                ]
                self._conn.executemany(
                    "INSERT INTO tags(name, display_name) VALUES(?, ?)",
                    tag_rows,
                )

                association_rows = [
                    (directory, token)
                    for token in ordered_tokens
                    for directory in sorted(filtered[token])
                ]
                self._conn.executemany(
                    "INSERT INTO entry_tags(entry_path, tag_name) VALUES(?, ?)",
                    association_rows,
                )

            self._conn.commit()

    def _tokenize(self, name: str) -> Set[str]:
        tokens = {match.group(0).lower() for match in re.finditer(r"[0-9A-Za-z]+", name)}
        return {token for token in tokens if len(token) >= 2}

    def _format_tag_display(self, token: str) -> str:
        if token.isalpha():
            return token.capitalize()
        return token


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="为大型媒体库构建 SQLite 索引")
    parser.add_argument("root", type=Path, help="需要建立索引的根目录")
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("media_index.db"),
        help="生成的 SQLite 数据库存放位置（默认：media_index.db）",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="工作线程数量（默认使用逻辑 CPU 数量）",
    )
    parser.add_argument(
        "--follow-symlinks",
        action="store_true",
        help="在索引过程中跟随符号链接",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=512,
        help="写入磁盘前缓冲的条目数量",
    )
    parser.add_argument(
        "--min-tag-frequency",
        type=int,
        default=2,
        help="某个关键词至少需要匹配多少个目录后才会升级为标签",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"],
        help="索引过程使用的日志级别",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(level=getattr(logging, args.log_level))

    with DirectoryIndexer(args.root, args.database, follow_symlinks=args.follow_symlinks) as indexer:
        indexer.build_index(
            max_workers=args.workers,
            batch_size=args.batch_size,
            min_tag_frequency=args.min_tag_frequency,
        )
    LOGGER.info("索引已写入 %s", args.database)
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
