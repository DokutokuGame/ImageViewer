# ImageViewer

ImageViewer 是一个**早期开发阶段**的本地桌面媒体浏览器：选择图片目录后，它会扫描叶子目录、分页展示缩略图，并提供应用内大图预览与前后导航。文件只在本机读取；当前项目尚未提供安装包、稳定性承诺或正式发布版本。

> [!IMPORTANT]
> **许可证状态：尚未授权公开使用。** 版权所有者还没有书面确认开源许可证，仓库中因此刻意不提供 `LICENSE`。在许可证落地前，默认版权规则适用；请勿将代码的可见性理解为复制、修改或再分发许可。候选许可证与依赖分析见 [许可证分析](docs/license-analysis.md)。

## 五分钟开始使用

### 1. 准备环境

- Node.js 18 或更高版本（建议使用当前 LTS）
- npm
- Electron 所需的桌面环境；Linux 还需要 GTK/ATK 等运行库

### 2. 安装并启动

```bash
git clone <仓库地址>
cd ImageViewer
npm ci
npm start
```

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
