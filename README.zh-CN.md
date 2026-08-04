# ImageViewer

[English](README.md) | **简体中文**

[![Python validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml)
[![Node and Electron validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml)
[![Repository hygiene](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml)

ImageViewer 是一个**早期开发阶段**的本地桌面媒体浏览器：选择图片目录后，它会扫描叶子目录、分页展示缩略图，并提供应用内大图预览与前后导航。文件只在本机读取；当前项目已发布 Windows x64 预览便携包，但尚不提供稳定性、兼容性或响应时限承诺。

## 下载

- [ImageViewer v0.1.0](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.0)：Windows x64 免安装便携包；
- 下载 ZIP 和同名 `.sha256` 文件后，按 [v0.1.0 发布说明](docs/releases/v0.1.0.md)
  核对校验值。

程序尚未签名，Windows SmartScreen 可能显示未知发布者提示。macOS 和其他 Windows
架构尚未提供下载。

## 许可证

版权所有者已确认仓库中的原创代码与文档均为其个人贡献，并以
[MIT License](LICENSE) 授权。该授权也涵盖 `app/` 历史原型；`app/` 继续随源码发布，
但仍不是当前支持的应用入口。第三方依赖继续适用各自的许可证，相关分析见
[许可证与代码来源分析](docs/license-analysis.md)。

## 快速开始（统一入口）

### 1. 准备环境

- Node.js 20.18.1 至 22.x（建议 Node.js 20 LTS）与 npm 10 或更高版本
- Python 3.10 至 3.13（测试入口同时验证实验性 Python 组件）
- Electron 所需的桌面环境；Linux 还需要 GTK/ATK 等运行库

### 2. 安装并启动

```bash
git clone <仓库地址>
cd ImageViewer
npm ci
python -m pip install -e '.[dev]'
npm run check:env
npm run dev
```

`npm test` 和 `npm run build` 会运行 Python 测试，因此全新 clone 必须先执行上述
Python 开发依赖安装命令。所有命令都从仓库根目录运行：`npm run dev` 用于开发与首次启动，`npm test`
运行 Node 和 Python 测试，`npm run build` 依次执行环境检查、静态检查、测试和
`npm pack --dry-run`（只验证包内容，不生成安装包）。`npm start` 是 `npm run dev`
的兼容别名。版本不受支持时，环境检查会直接给出可安装的版本范围。

不想选择真实媒体时，可运行 `npm run demo`。演示模式只在内存中提供虚拟目录名和
数量，不包含、不生成也不读取媒体文件。程序的偏好文件保存在 Electron 用户数据目录；
目录无效、读取权限不足或该目录不可写时，界面/启动对话框会说明出错路径和可采取的
操作。若 Electron 无法启动，请先运行 `npm run check:env`，再确认当前会话具有图形
桌面以及 Electron 所需系统库。

在窗口中选择一个本地媒体目录，然后：

1. 从左侧选择扫描出的叶子目录；
2. 在缩略图网格中滚动浏览，内容会分页加载；
3. 点击图片进入应用内预览，使用前后按钮或键盘方向键导航；
4. 使用“打开目录”等操作回到系统文件管理器。

扫描大型目录可能需要一段时间。请先用已备份、非敏感的测试目录体验；本项目仍处早期阶段，尚未完成跨平台端到端验证。

## 当前实现与仓库结构

| 路径 | 状态 | 用途 |
| --- | --- | --- |
| `src/main/`、`renderer/` | **主实现** | Electron 主进程、目录扫描、偏好存储和渲染界面 |
| `src/image_viewer/` | 实验性组件 | Python/SQLite 索引器与中文菜单模型，尚未接入主界面 |
| `app/` | 历史原型 | 独立 Electron 原型，不是当前支持的启动入口 |
| `tests/` | 部分覆盖 | 目前仅覆盖 Python 组件，Electron 尚缺自动化测试 |

Python 实验组件可用下面的方式验证：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
```

## 平台验证状态

| 平台 | 状态 | 依据 |
| --- | --- | --- |
| Ubuntu 24.04 x64 | **已验证** | 2026-08-03 从不含依赖和本地数据的干净检出执行 `npm ci`、`npm run build`；CI 亦使用此平台 |
| Windows x64 | **预览版已发布** | Windows Server 2025 CI 构建、校验并全新解压；本地 Windows x64 完成五秒启动冒烟测试 |
| macOS | **未验证** | 当前没有该平台的干净环境启动记录，不推断支持 |

“已验证”只代表上述源码流程。图形窗口启动还需要真实桌面会话；
无显示器 CI 中只验证 Electron 入口、语法和包内容。

Windows 便携包的固定环境、命令、检查边界和校验方法见
[v0.1.0 发布说明](docs/releases/v0.1.0.md)。该便携包及校验文件由
`Windows release package` 工作流生成；自动验证和五秒启动冒烟测试不等同于已签名发布或完整界面验收。

## 持续集成

GitHub Actions 固定使用 Python 3.12.8、Node.js 20.18.1，并在仓库根目录复现安装、测试、静态检查和 Electron 包内容验证。Node 工作流使用与本地相同的 `npm run check`、`npm test` 和 `npm run build` 入口；仓库卫生工作流还检查 JSON、Markdown、超过 5 MiB 的受版本控制文件和常见密钥。工作流只输出日志，不上传用户目录、数据库、媒体文件或其他 artifact。

根目录 `package-lock.json` 只属于当前主应用。历史原型 `app/` 暂无自己的锁文件，因此 CI 不在该目录安装依赖，也不会向上查找并误用根锁文件；在原型归属确认并生成独立锁文件前，只对其自有 JavaScript 做语法检查。每个工作流步骤的名称均标注实际命令及工作目录，失败时可直接定位到对应验证。

## 反馈与贡献

- 遇到可复现的问题：使用 [Bug 报告](.github/ISSUE_TEMPLATE/bug_report.yml)。
- 有功能构想：使用 [功能建议](.github/ISSUE_TEMPLATE/feature_request.yml)。
- 怀疑存在安全问题：**不要创建公开 Issue**，请按 [安全政策](SECURITY.md) 私下报告。
- 准备提交修改：先阅读 [贡献指南](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md) 和 [Roadmap](ROADMAP.md)，再按 [PR 模板](.github/pull_request_template.md) 自检。

维护者会尽力回应，但在项目进入稳定阶段前不承诺响应时限、兼容性或发布节奏。

## 项目状态

- 成熟度：探索/原型阶段（`0.x`），接口、数据格式与产品方向均可能变化。
- 发布：已提供 [v0.1.0 Windows x64 预览便携包](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.0)。
- 测试：Python 单元测试可用；Electron 主要依赖语法与人工验证。
- 计划：参见 [ROADMAP.md](ROADMAP.md)。
- 变更：参见 [CHANGELOG.md](CHANGELOG.md)。
- 许可证：原创代码与文档采用 [MIT License](LICENSE)；第三方组件适用各自许可证。

发布状态、公开数据口径、人工复核责任与正式 Release 后的周报规则见
[维护与发布证据记录](docs/maintenance-evidence.md)。该记录区分候选构建与正式发布，
并对无法从 GitHub 或 Release 页面核验的数据明确标记为“暂缺”。

## v0.1.0 发布后验证边界

v0.1.0 已作为早期预览版发布。当前证据只覆盖可重复的 Windows x64 构建、校验、全新解压和
五秒启动冒烟测试；完整真实媒体操作、更长时间稳定性、代码签名及其他平台仍待验证。后续发布不得把当前预览边界扩大表述为稳定支持。
