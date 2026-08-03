# ImageViewer

[![Python validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml)
[![Node and Electron validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml)
[![Repository hygiene](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml)

ImageViewer 是一个**早期开发阶段**的本地桌面媒体浏览器：选择图片目录后，它会扫描叶子目录、分页展示缩略图，并提供应用内大图预览与前后导航。文件只在本机读取；当前项目尚未提供安装包、稳定性承诺或正式发布版本。

> [!IMPORTANT]
> **许可证状态：尚未授权公开使用。** 版权所有者还没有书面确认开源许可证，仓库中因此刻意不提供 `LICENSE`。在许可证落地前，默认版权规则适用；请勿将代码的可见性理解为复制、修改或再分发许可。候选许可证与依赖分析见 [许可证分析](docs/license-analysis.md)。

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
npm run check:env
npm run dev
```

所有命令都从仓库根目录运行：`npm run dev` 用于开发与首次启动，`npm test`
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
| Windows | **未验证** | 当前没有该平台的干净环境启动记录，不推断支持 |
| macOS | **未验证** | 当前没有该平台的干净环境启动记录，不推断支持 |

“已验证”只代表上述源码流程，不代表已有安装包。图形窗口启动还需要真实桌面会话；
无显示器 CI 中只验证 Electron 入口、语法和包内容。

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
- 发布：没有官方二进制安装包。
- 测试：Python 单元测试可用；Electron 主要依赖语法与人工验证。
- 计划：参见 [ROADMAP.md](ROADMAP.md)。
- 变更：参见 [CHANGELOG.md](CHANGELOG.md)。
- 许可证：等待所有者书面确认；当前**不是已授权的开源发布**。

## v0.1.0 发布条件评审

周末评审使用以下阻断清单；任意一项未确认都**不得进入正式发布**：

- [ ] 版权所有者已书面确认许可证且仓库包含匹配的 `LICENSE`；
- [ ] `src/main/` 与 `renderer/` 作为主架构已由维护者确认，不把 `app/` 原型混入发布；
- [ ] 必需 CI 在目标提交上全部通过；
- [ ] 至少一个明确列出的受支持平台完成全新 clone、安装、构建和图形界面首次启动；
- [ ] 发布内容不含真实媒体、用户路径、数据库、密钥或本地构建产物。

当前许可证尚未确认，因此即使其他检查通过，v0.1.0 也仍是候选里程碑，不能正式发布。
