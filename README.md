# ImageViewer

This repository contains utilities for building and maintaining a fast index
for very large local media libraries. The index is persisted to SQLite so that
subsequent launches of the ImageViewer UI can open a directory tree with
millions of entries almost instantly instead of rescanning the filesystem every
single time.

## Features

- Multi-threaded crawler that walks the directory tree using efficient
  `os.scandir` primitives.
- Incremental updates: entries that already exist in the index are re-used and
  removed when files disappear.
- Configurable batch size to balance memory usage and write performance.
- Command line interface for building and refreshing the index.

## Usage

Create a virtual environment (optional) and install the project in editable
mode with the development dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

Then build an index:

```bash
python -m image_viewer.indexer /path/to/your/library --database media_index.db --workers 8
```

On subsequent runs only new or changed files are scanned, so pointing the tool
at the same folder will refresh the index quickly.

### Programmatic use

```python
from image_viewer.indexer import DirectoryIndexer

with DirectoryIndexer("/path/to/library", "media_index.db") as indexer:
    indexer.build_index(max_workers=8)
    for entry in indexer.list_directory("season1"):
        print(entry.path, entry.size)
```

## Tests

Run the automated checks with:

```bash
pytest
```
