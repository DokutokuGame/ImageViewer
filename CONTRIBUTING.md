# 贡献指南

感谢关注 ImageViewer。项目仍处原型阶段，先讨论、后实现能减少重复工作。

## 开始之前

1. 阅读 [README](README.md) 了解主实现与成熟度，并查看 [Roadmap](ROADMAP.md)。
2. 搜索现有 Issue；缺陷请提交 Bug 报告，较大改动请先提交功能建议并说明使用场景。
3. 遵守 [行为准则](CODE_OF_CONDUCT.md)。安全问题按 [安全政策](SECURITY.md) 私下报告。
4. 注意当前尚无正式开源许可证。提交贡献即表示你有权提交这些内容，但在所有者明确贡献条款与项目许可证前，维护者可能暂缓合并外部代码。

## 本地开发

```bash
npm ci
npm start
```

Python 实验组件：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
```

提交前至少运行：

```bash
for file in src/main/*.js renderer/*.js; do node --check "$file"; done
PYTHONPATH=src pytest
```

涉及可见界面时，请同时人工验证选择目录、分页滚动、图片预览和键盘导航，并在 PR 中附截图。不要提交私人媒体、索引数据库、密钥或构建产物。

## 提交与 PR

- 每个 PR 聚焦一个问题，说明动机、范围、风险、测试和回滚方式。
- 新行为应补充测试；无法测试时需明确原因和人工验证步骤。
- 用户可见变化同步更新 README 和 CHANGELOG 的“未发布”章节。
- 代码审查评论与本项目提交信息使用中文；建议格式为 `类型：简短说明`，例如 `修复：避免空目录导致扫描失败`。
- 完整填写 PR 模板并关联 Issue。维护者可能要求拆分变更或在许可证确认后再合并。

## 代码约定

- 保持现有 JavaScript 风格：两空格缩进、分号、单引号。
- 不在 import/require 外包裹 `try/catch`。
- 文件系统和 IPC 错误应给用户可理解的降级结果，避免暴露敏感本地路径。
- 不无故引入依赖；新增依赖须在 PR 中记录用途、版本、许可证及替代方案。
