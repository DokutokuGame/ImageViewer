# ImageViewer

该仓库包含用于构建和维护超大本地媒体库索引的工具。索引数据存储在 SQLite 中，因此在后续启动 ImageViewer 界面时，无需每次都重新扫描文件系统，就能几乎即时打开拥有数百万条目的目录树。

## 功能亮点

- 使用高效的 `os.scandir` 原语的多线程目录爬虫。
- 增量更新：已存在于索引中的条目会被复用，当文件消失时会被移除。
- 可配置的批量大小，用于平衡内存占用与写入性能。
- 提供命令行界面以构建和刷新索引。
- 基于目录名称关键词的自动标签功能，便于进行语义分类。

## 使用方法

推荐先创建虚拟环境（可选），并以开发模式安装项目及其依赖：

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
```

随后构建索引：

```bash
python -m image_viewer.indexer /path/to/your/library --database media_index.db --workers 8
```

后续运行时，仅扫描新增或发生变化的文件，因此指向同一目录即可快速刷新索引。

使用 `--min-tag-frequency` 可以控制关键词至少在多少个目录名称中出现后才会升级为标签。例如，以下命令要求某个关键词至少在三个目录名称中出现一次，才会生成对应标签：

```bash
python -m image_viewer.indexer /path/to/your/library --min-tag-frequency 3
```

### 以代码方式调用

```python
from image_viewer.indexer import DirectoryIndexer

with DirectoryIndexer("/path/to/library", "media_index.db") as indexer:
    indexer.build_index(max_workers=8, min_tag_frequency=2)
    for entry in indexer.list_directory("season1"):
        print(entry.path, entry.size)

    for tag in indexer.list_tags():
        print(tag.display_name, tag.match_count)

    beach_folders = indexer.list_directories_by_tag("beach")
    print("海滩主题目录:", [entry.path for entry in beach_folders])
```

## 目录分类规划与可行性分析

自动标签系统会依据相似的目录名称对文件夹分组，从而可以通过诸如 `Vacation` 或 `Family` 的语义标签来浏览大型媒体库。该实现完全依赖 SQLite 索引中已存储的目录名称，因此即使面对数 TB 的资源集合，仍然十分轻量。

- **分词策略：** 将目录名称拆分为字母和数字组成的 token，忽略标点符号。长度小于两个字符的 token 会被丢弃，以避免如 `S`、`X` 等缩写带来的噪声。
- **共享关键词检测：** 只有当某个 token 至少出现在 `min_tag_frequency` 个不同目录中时，才会被提升为标签。该阈值既能避免一次性目录名称污染标签列表，又能凸显重复出现的主题。
- **标签元数据：** 会同时存储规范化的 token 和便于阅读的展示字符串。标签与目录之间的关联被持久化，以便界面在筛选标签对应目录时能够即时返回结果。
- **可行性：** 标签构建复用现有的目录索引，并在写入 SQLite 之前于内存中批处理完成。该流程的复杂度与目录数量（而非文件数量）成正比，且分词仅是针对每个目录名称执行一次正则表达式匹配，因此对索引流程影响极小。外键约束可以确保在更新或删除条目时，标签关联保持同步。

该设计为未来的扩展留出了空间，例如按不同语言自定义分词器或允许用户定义同义词，而无需修改核心数据模型。

## 测试

运行自动化检查：

```bash
pytest
```
