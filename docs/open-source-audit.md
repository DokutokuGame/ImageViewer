# 开源准备审计报告

> [!NOTE]
> 本报告是 2026-08-03 当时的历史快照。许可证相关的 OA-02 与 OA-13 元数据发现已由
> 后续的 [MIT License](../LICENSE) 和[许可证确认记录](license-analysis.md)解决；其他发现
> 是否解决仍应以当前文件、工作流和维护记录为准。

- 审计日期：2026-08-03
- 审计分支：`chore/open-source-audit`
- 基线提交：`859e124ccc191b8db9776d242b5e579b6bbd3fdb`

## 结论摘要

仓库包含一个 Python SQLite 索引器和两套相互独立的 Electron 实现。Python 核心测试通过，两个 Node 依赖安装也成功；但当前容器缺少 Electron 所需的系统动态库，无法完成 GUI 启动确认。仓库在公开发布前的主要阻断项是缺少许可证正文、无法证明审计分支来自远端最新默认分支，以及 `app/` 未提交依赖锁文件。敏感信息和已跟踪媒体/数据库文件的静态检查未发现命中。

## 范围与方法

- 目录结构及 Git 跟踪/忽略状态。
- 根目录 Electron（`src/main/`、`renderer/`）与 `app/` Electron 的入口、安全边界和重复实现。
- Python 包、SQLite schema、pytest 测试和 README 示例。
- Python、根 Node 与 `app/` Node 依赖及其锁定方式。
- 当前树和全部本地 Git 历史中的常见敏感文件名信号。
- 媒体、SQLite 数据库和构建产物的跟踪及忽略规则。
- README 与实际入口的差异，以及许可证/NOTICE 信号。

风险等级使用“阻断 / 高 / 中 / 低 / 信息”。“确认状态”区分已确认事实、检查未发现和受环境限制未确认；“检查未发现”不是专业密钥扫描或历史清理的替代品。

## 发现清单

### OA-01：无法确认基于最新远端默认分支

- **文件路径：** `.git/HEAD`、`.git/refs/heads/chore/open-source-audit`（Git 元数据，不纳入提交）
- **风险等级：** 阻断
- **证据：** 环境中没有 `origin` remote、`origin/HEAD`、本地 `main` 或其他远端引用；任务开始时只有 `work`，其 HEAD 为 `859e124`。审计分支从该提交创建，未直接修改 `main`，但无法执行 `fetch` 或把该提交与“最新默认分支”比较。
- **推荐处理方式：** 在有远端配置的环境中执行 `git fetch origin`，确认 `origin/HEAD`，再将本分支 rebase 到对应远端默认分支；若默认分支是 `main`，使用 `git rebase origin/main`。
- **确认状态：** 受环境限制未确认；已确认未直接修改 `main`。

### OA-02：缺少可分发的许可证正文

- **文件路径：** `package.json`、仓库根目录（缺少 `LICENSE`/`COPYING`）
- **风险等级：** 阻断
- **证据：** 根 `package.json` 声明 `MIT`，但当前树和本地历史均未找到许可证正文；`pyproject.toml` 也未声明标准化 license 元数据。仅有包清单中的字符串不足以向接收者提供完整授权条款。
- **推荐处理方式：** 由版权持有人确认授权后提交完整 `LICENSE`，补充版权年份/主体，并同步 `pyproject.toml`、`app/package.json` 和 README 的许可证说明；需要第三方归属时增加 `NOTICE`。
- **确认状态：** 已确认。

### OA-03：存在两套独立 Electron 应用且版本漂移

- **文件路径：** `package.json`、`src/main/`、`renderer/`、`app/package.json`、`app/main.js`、`app/preload.js`、`app/src/`
- **风险等级：** 高
- **证据：** 根入口为 `src/main/main.js`，锁定 Electron `26.2.4`；`app/` 入口为 `app/main.js`，声明 Electron `^28.2.0`。两边各有 main、preload、renderer 和目录扫描/状态逻辑，发布入口、功能归属及修复同步策略不明确。
- **推荐处理方式：** 指定唯一受支持的应用和发布入口；合并共用模块或明确将另一实现标为原型/弃用，并用 CI 矩阵分别验证仍受支持的入口。
- **确认状态：** 已确认。

### OA-04：`app/` 缺少提交的锁文件

- **文件路径：** `app/package.json`、`app/package-lock.json`（当前仓库缺失）
- **风险等级：** 高
- **证据：** `app/package.json` 使用 `^` 范围，审计前没有 `app/package-lock.json`；`npm install` 会现场生成锁文件，因此不同时间安装可能解析出不同依赖树，也无法在 CI 使用 `npm ci`。
- **推荐处理方式：** 审核后提交 `app/package-lock.json`，CI 改用 `npm ci`，并建立依赖更新和安全公告处理流程。
- **确认状态：** 已确认；本次安装生成的临时锁文件已删除，避免审计文档夹带未经评审的依赖变更。

### OA-05：依赖安全审计无法完成

- **文件路径：** `package-lock.json`、`app/package.json`
- **风险等级：** 高
- **证据：** 根目录和 `app/` 的 `npm audit --omit=dev` 都因 registry audit endpoint 返回 HTTP 403 而失败，不能据此断言无已知漏洞。两套 Electron 主版本也都需要单独评估支持状态。
- **推荐处理方式：** 在可访问 npm advisory 服务的 CI 中运行 `npm audit` 或组织批准的 SCA 工具，记录可利用性分析并升级 Electron/传递依赖。
- **确认状态：** 受网络策略限制未确认。

### OA-06：README 只描述 `app/`，未说明根 Electron 入口

- **文件路径：** `README.md`、`package.json`、`app/package.json`
- **风险等级：** 中
- **证据：** README 的 GUI 步骤只有 `cd app && npm install && npm start`，但根 `package.json` 同样定义可启动应用；README 没有解释两套实现的关系、支持级别、Node/npm 版本或根入口验证方式。当前分支相对基线的 README diff 为空。
- **推荐处理方式：** 在确定唯一入口后更新 README：给出支持矩阵、前置系统库、锁文件安装命令、开发/发布入口，以及另一实现的状态。
- **确认状态：** 已确认。

### OA-07：Python 安装流程缺少可复现锁定，且本环境按 README 安装失败

- **文件路径：** `README.md`、`pyproject.toml`
- **风险等级：** 中
- **证据：** README 的 `pip install -e .[dev]` 在隔离虚拟环境中尝试获取 `setuptools>=61.0`，因代理返回 403 而失败，随后该虚拟环境无法运行索引器或 pytest。项目只给出 `pytest>=7` 下限，没有锁文件或 constraints。
- **推荐处理方式：** 在联网 CI 验证 README 原命令；为开发/CI 提供 constraints 或锁定方案，声明支持的 Python 版本，并考虑离线构建说明。不要把此次 403 误判为项目逻辑缺陷。
- **确认状态：** 安装失败已确认；在此环境中按 README 的全新环境路径未确认可用。

### OA-08：SQLite schema 没有显式版本和迁移机制

- **文件路径：** `src/image_viewer/indexer.py`
- **风险等级：** 中
- **证据：** schema 通过运行时 `CREATE TABLE IF NOT EXISTS` 创建 `entries`、`tags`、`entry_tags` 及索引，但未使用 `PRAGMA user_version`、迁移表或版本化迁移脚本。已有用户数据库在字段或约束变化后可能无法安全升级。
- **推荐处理方式：** 定义 schema 版本、事务化迁移和备份/回滚策略；增加从旧版本升级以及外键/索引完整性测试。
- **确认状态：** 已确认。

### OA-09：测试覆盖集中于 Python，Electron 行为无自动化测试

- **文件路径：** `tests/`、`src/main/`、`renderer/`、`app/`
- **风险等级：** 中
- **证据：** 现有 6 个 pytest 用例覆盖初次/增量索引、自动标签和中文菜单；未发现 Node 单元测试、IPC 合约测试、渲染器测试或端到端启动测试。`app` 的 lint 脚本仅检查 `app/src`，不包含 `app/main.js` 与 `app/preload.js`。
- **推荐处理方式：** 为两套实现或最终保留实现增加 IPC、路径验证、分页、偏好设置和渲染测试；扩大 lint 范围到所有自有 JS，并在有显示服务器和系统库的 CI 做 Electron smoke test。
- **确认状态：** 已确认。

### OA-10：Electron 启动因系统依赖缺失而未验证

- **文件路径：** `package.json`、`app/package.json`
- **风险等级：** 中
- **证据：** 两个 `npm start` 都在加载 Electron 时因缺少 `libatk-1.0.so.0` 退出（状态 127），应用代码尚未进入可观察的启动阶段。
- **推荐处理方式：** 使用官方支持且安装 GTK/ATK 等 Electron 运行时库的 Linux CI 镜像，通过 Xvfb 执行带超时和窗口就绪断言的 smoke test；其他目标平台分别验证。
- **确认状态：** 受环境限制未确认。

### OA-11：敏感信息静态信号未发现命中，但缺少持续扫描

- **文件路径：** 当前全部已跟踪文件及本地可见 Git 历史
- **风险等级：** 低
- **证据：** 对当前树进行常见 password/secret/API key/token/私钥头模式搜索，仅命中业务分词变量 `token`；对全部本地历史的可疑文件名搜索无命中。仓库没有提交 `.env` 示例或自动化 secret-scanning 配置。
- **推荐处理方式：** 公布前使用 gitleaks/trufflehog 等扫描完整远端历史，并在 pre-commit/CI 和托管平台启用密钥扫描；如发现凭据，先轮换再清理历史。
- **确认状态：** 检查未发现；由于没有远端引用，完整远端历史未确认。

### OA-12：媒体、数据库与构建产物未被跟踪，忽略规则基本有效

- **文件路径：** `.gitignore`、当前全部已跟踪文件
- **风险等级：** 低
- **证据：** 当前树未找到已跟踪的常见图片、视频、`.db`、`.sqlite` 或 `.sqlite3` 文件；`.gitignore` 覆盖 `*.db`、`*.db-*`、`*.sqlite3`、`node_modules/`、`dist`、`out` 和 `build`。但未覆盖通用 `*.sqlite`、`.venv/`、`*.egg-info/` 以及若干大型媒体扩展名。
- **推荐处理方式：** 增补 `*.sqlite`、`.venv/`、`*.egg-info/`；根据项目政策忽略原始媒体目录，并用 pre-commit/CI 限制超大文件。确需示例媒体时确认许可并保持最小体积。
- **确认状态：** 当前本地可见树和历史检查未发现。

### OA-13：构建与发布元数据不完整

- **文件路径：** `package.json`、`app/package.json`、`pyproject.toml`
- **风险等级：** 中
- **证据：** 两个 Node 清单只有开发启动（以及 `app` lint）脚本，没有打包、制品签名、发布、测试或跨平台构建入口；Python 有 PEP 517 构建入口，但没有 console script、项目 URL、分类器和 license 元数据。
- **推荐处理方式：** 确定发行物后增加可重复的 build/package 脚本、制品清单与签名流程；完善 Python/Node 包元数据，或明确标记这些包为不发布。
- **确认状态：** 已确认。

## 命令与测试结果

按要求先执行 README Python 路径，再执行根 Node 路径，最后执行 `app/` 路径。失败后使用仓库现有系统 Python 做了诊断性补充验证；该补充不替代 README 全新环境验证。

| 顺序 | 命令 | 结果 |
| --- | --- | --- |
| 1 | `python -m venv /tmp/imageviewer-audit-venv` | 通过（退出 0）。 |
| 2 | `/tmp/imageviewer-audit-venv/bin/pip install -e '.[dev]'` | 环境限制失败（退出 1）：构建隔离下载 setuptools 时代理 403。 |
| 3 | `/tmp/imageviewer-audit-venv/bin/python -m image_viewer.indexer /tmp/imageviewer-audit-library --database /tmp/imageviewer-audit.db --workers 1` | 失败（退出 1）：上一步未安装包，`ModuleNotFoundError`。 |
| 4 | `/tmp/imageviewer-audit-venv/bin/pytest` | 失败（退出 127）：上一步未安装 pytest。 |
| 5 | `npm install` | 通过（退出 0，依赖已是最新）。 |
| 6 | `for file in src/main/*.js renderer/*.js; do node --check "$file"; done` | 通过（退出 0）。 |
| 7 | `timeout 8s npm start` | 环境限制失败（退出 127）：缺少 `libatk-1.0.so.0`。 |
| 8 | `cd app && npm install` | 通过（退出 0）；生成的临时 lockfile 未纳入本次提交。 |
| 9 | `cd app && npm run lint` | 通过（退出 0），但脚本范围仅 `app/src`。 |
| 10 | `cd app && timeout 8s npm start` | 环境限制失败（退出 127）：缺少 `libatk-1.0.so.0`。 |
| 补充 | `PYTHONPATH=src python -m image_viewer.indexer /tmp/imageviewer-audit-library --database /tmp/imageviewer-audit-fallback.db --workers 1` | 通过（退出 0），创建的数据库含预期 schema。 |
| 补充 | `PYTHONPATH=src pytest` | 通过：6 passed in 1.22s。 |
| 补充 | `for file in app/main.js app/preload.js app/src/*.js; do node --check "$file"; done` | 通过（退出 0）。 |
| 补充 | `npm audit --omit=dev`（根目录及 `app/`） | 环境限制失败（退出 1）：两个请求均收到 403。 |

## 未确认事项与风险

1. 远端最新默认分支及完整远端历史；合并前必须 fetch/rebase 后复核审计差异。
2. 全新联网 Python 环境中的 README 安装、索引器和 pytest 连续流程。
3. 两套 Electron 的真实窗口启动、IPC 交互和跨平台行为。
4. npm 已知漏洞、第三方许可证兼容性和所有传递依赖的归属义务。
5. 仓库代码和素材的版权主体是否一致同意采用 MIT 或其他许可证。

## 回滚方式

本分支只新增本报告。需要回滚时，在合并前删除分支即可；合并后使用 `git revert <本次审计提交>` 生成反向提交。不要在共享历史中强推或直接改写 `main`。

## 下一阶段建议

1. 配置远端并把分支 rebase 到最新默认分支，重新运行全套检查。
2. 由权利人落地许可证正文和第三方 NOTICE/SBOM 流程。
3. 决定唯一 Electron 产品入口，提交对应锁文件并消除重复实现漂移。
4. 在具备网络、ATK/GTK 与 Xvfb 的 CI 中加入 Python、lint、SCA 和 Electron smoke test。
5. 建立 schema 迁移、Electron 自动化测试、secret scan、依赖更新及发布签名流程。
