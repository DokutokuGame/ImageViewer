# 项目维护与发布证据记录

更新日期：2026-08-04

> 本页记录发布状态、维护活动、公开项目数据及人机协作边界。只收录能够由仓库文件、
> GitHub 或 Release 页面核验的事实；候选构建不计作正式发布，仓库作者的活动不计作外部采用。

## 当前结论

| 条件 | 状态 | 可核验证据 | 结论 |
| --- | --- | --- | --- |
| 许可证已确认 | 满足 | [MIT License](../LICENSE)、[许可证分析](license-analysis.md)、[README 许可证说明](../README.md#许可证) | 唯一版权所有者已书面确认个人权属与 MIT 授权，元数据已同步。 |
| 正式 Release 可下载 | 满足 | [GitHub Release v0.1.0](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.0)、[v0.1.0 发布说明](releases/v0.1.0.md) | 已提供 Windows x64 便携包和 SHA-256 文件；项目仍是早期预览阶段。 |
| CI 稳定 | 暂缺 | [Actions](https://github.com/DokutokuGame/ImageViewer/actions)、[Node 工作流](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml)、[Python 工作流](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml)、[仓库检查](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml) | 已配置工作流，但尚未记录连续成功观察窗口，不能称为稳定。 |
| README 完整 | 部分满足 | [README](../README.md) | 已有下载、安装、验证、平台状态、贡献、安全与许可证入口；完整界面验收与跨平台证据仍待补充。 |
| 最近 30 天有维护记录 | 满足 | [Pull requests](https://github.com/DokutokuGame/ImageViewer/pulls?q=is%3Apr+updated%3A%3E%3D2026-07-05)、[提交记录](https://github.com/DokutokuGame/ImageViewer/commits) | 2026-08-03 有合并与发布准备维护记录。 |

**当前发布决定：已发布 v0.1.0 早期预览版。** 该决定不代表稳定性或跨平台承诺，后续以 Release 和验证记录为准。

## 周报起点与记录规则

周报以首个 GitHub **正式 Release 的 `published_at` 日期**为第一周起点，按 UTC
自然周（周一至周日）记录。首周的确切起点应从
[GitHub Release v0.1.0](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.0) 的 `published_at` 核对；
不以仓库创建日期、tag、PR 合并时间或 Actions artifact 代替发布日期。

正式发布后，每一周必须补充以下内容，即使没有活动也填写“0”或“无变化”：

| 周期（UTC） | Issue 处理/修复 | PR 审查 | CI 状态 | Roadmap 变化 | 补丁发布 |
| --- | --- | --- | --- | --- | --- |
| `YYYY-MM-DD`—`YYYY-MM-DD` | 链接 Issue、修复 PR；无则 0 | 链接已审查 PR、审查结论；无则 0 | 链接该周默认分支和发布提交的工作流运行 | 链接 Roadmap diff/Issue；无则“无变化” | 链接 Release；无则 0 |

只统计 GitHub 仓库中可打开的 Issue、PR、Review、Actions run、commit 和 Release。
补记时不得根据提交信息猜测 Issue 数、审查人或 CI 结果。

## 可核验项目数据

数据核验入口：

- Star：暂缺（更新时从 [仓库主页](https://github.com/DokutokuGame/ImageViewer) 读取并注明核验时间）；
- Fork：暂缺（更新时从 [Forks 页面](https://github.com/DokutokuGame/ImageViewer/forks) 读取并注明核验时间）；
- 正式 Release：1；当前为 [v0.1.0](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.0)；
- Release 下载：暂缺；应从 v0.1.0 的 asset 数据核对并注明时间，Actions artifact 不计下载量；
- 外部 Issue：暂缺；须逐项检查 [Issues](https://github.com/DokutokuGame/ImageViewer/issues?q=is%3Aissue) 的作者身份后统计；
- 外部 PR：暂缺；须逐项检查 [Pull requests](https://github.com/DokutokuGame/ImageViewer/pulls?q=is%3Apr) 的作者身份后统计；
- 其他外部反馈：0；目前没有链接到可公开核验的讨论、Issue 或 Release 反馈。

“外部”指与仓库作者/维护者无关的账号。无法仅凭公开页面判定关联关系时记为“暂缺”，
不把作者自己的 Issue、PR、Star、Fork 或下载算作社区采用。

## Codex 使用与人工责任记录

Codex 参与不表述为“自动维护”。每条记录必须同时包含具体任务、人工复核方式、运行过的
测试和最终决策者；缺少任何一项时不将该记录作为已完成维护的依据。

| 日期 | 具体任务与证据 | Codex 产出 | 人工复核方式 | 运行过的测试 | 最终决策者 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-03 | [PR #13：开源准备审计](https://github.com/DokutokuGame/ImageViewer/pull/13) | 整理许可证、入口、依赖、测试与发布阻断项 | 维护者通过 PR diff 复核报告范围和结论后决定是否合并；不把合并等同于逐行人工验证 | 以 PR 描述和工作流日志所列命令为准；无法由公开页面确认的命令不补写 | 合并 PR 的仓库维护者（以 PR 事件记录为准） |
| 2026-08-03 | [PR #15：验证工作流](https://github.com/DokutokuGame/ImageViewer/pull/15) | 增加 Python、Node 和仓库卫生检查 | 维护者核对 workflow diff、权限、固定版本和实际 run 结果后决定是否合并 | [PR checks](https://github.com/DokutokuGame/ImageViewer/pull/15/checks)；具体成功/失败以各 run 为准 | 合并 PR 的仓库维护者（以 PR 事件记录为准） |
| 2026-08-03 | [PR #16：首次运行体验](https://github.com/DokutokuGame/ImageViewer/pull/16) | 统一入口、错误提示、演示模式与 README | 维护者按 README 从干净检出复现，并人工检查首次启动及错误文案后决定；未留公开记录的人工步骤不宣称已完成 | [PR checks](https://github.com/DokutokuGame/ImageViewer/pull/16/checks)；平台人工验证见 README | 合并 PR 的仓库维护者（以 PR 事件记录为准） |
| 2026-08-03 | [PR #17：Windows 候选包](https://github.com/DokutokuGame/ImageViewer/pull/17) | 增加便携候选包、SHA-256 和干净解压验证 | 维护者复核包内容、校验脚本、工作流日志和候选/正式发布边界后决定是否合并 | [PR checks](https://github.com/DokutokuGame/ImageViewer/pull/17/checks)、[Windows release package](https://github.com/DokutokuGame/ImageViewer/actions/workflows/windows-release.yml) | 合并 PR 的仓库维护者（以 PR 事件记录为准） |
| 2026-08-03 | [PR #21：v0.1.0 高风险依赖修复](https://github.com/DokutokuGame/ImageViewer/pull/21) | 升级 Electron、收紧渲染进程权限，并补齐发布包许可证通知与验证 | 维护者复核依赖变更、窗口安全配置、制品内容和 Windows 启动冒烟测试后决定是否合并 | [PR checks](https://github.com/DokutokuGame/ImageViewer/pull/21/checks)、[Windows release package](https://github.com/DokutokuGame/ImageViewer/actions/workflows/windows-release.yml) | 合并 PR 的仓库维护者（以 PR 事件记录为准） |

表中“人工复核方式”是合并前应执行且应在 GitHub 留痕的核验标准；它不是对未公开操作的
追认。汇总时只保留能由 Review、评论、check 或维护记录证明已完成的部分。

## 证据维护清单

对外说明中的每项主张必须指向以下真实页面，不允许只链接本汇总记录。证据包括：

1. [MIT License](../LICENSE) 提交和[依赖许可证复核记录](license-analysis.md)；
2. 首个正式 [Release](https://github.com/DokutokuGame/ImageViewer/releases) 及可下载 asset、校验值；
3. 默认分支和 Release 提交的连续成功 [Actions runs](https://github.com/DokutokuGame/ImageViewer/actions)；
4. 真实 benchmark 的代码、输入、环境、命令与结果；当前 benchmark 证据为**暂缺**；
5. [Roadmap](../ROADMAP.md) 的变更提交及其关联 Issue/PR；
6. 从首个正式 Release 当周开始的逐周 Issue、PR review、CI 与补丁记录；
7. 最近 30 天的 commit、Issue、Review、PR 或 Release 维护记录；
8. 可明确判定为非作者/维护者的外部 Issue、PR、下载或公开反馈；没有则写 0。

完成复核时，由维护者在 PR 中明确给出“发布/暂不发布”的最终决定，并链接该决定；Codex
可以整理证据和草拟文本，但不能代替许可证授权、人工验收、代码审查或发布决定。
