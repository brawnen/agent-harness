# Design Note: 将当前仓库运行时目录迁移到 .harness 并同步 CLI 与文档

## 背景

- task_id: `p14-dot-harness-runtime-migration`
- intent: `refactor`
- risk_level: `low`

## 目标

- 将当前仓库运行时目录迁移到 .harness 并同步 CLI 与文档

## 作用范围

- .harness
- packages/cli
- README.md
- README.en.md
- docs/2026-04-05-agent-harness-usage-guide-v0.1.md
- docs/2026-04-05-agent-harness-usage-guide-v0.1.en.md
- AGENTS.md
- .gitignore
- harness.yaml

## 方案

- 抽出统一 runtime path helper，默认把运行时根目录解析到 `.harness/`
- 保留对旧 `harness/` 的读取兼容，避免当前仓库和历史项目在迁移前直接失效
- 调整 CLI 核心运行时代码、`init`、`status`、`delivery`、Codex E2E，使新项目默认生成并消费 `.harness/`
- 将当前仓库自身的 `state / audit / reports / tasks` 从 `harness/` 迁移到 `.harness/`
- 同步更新 `harness.yaml`、README、usage guide、CLI README 和 AGENTS 里的运行时路径说明

## 风险与权衡

- 这是一次真实的 breaking change，如果不保留旧目录读兼容，当前仓库和旧项目会直接断掉
- 当前仓库已有历史任务状态和报告，迁移时必须保留 `.harness/state` 与 `.harness/reports` 内容
- `delivery commit` 的候选文件逻辑需要同时兼容 `.harness/reports` 与旧 `harness/reports`，否则会误把运行时产物纳入提交范围
- 文档更新需要和代码切换同步完成，否则外部用户会按旧 `harness/` 路径接入失败

## 验证计划

- `node --check` 覆盖 runtime helper、state/audit、init/status/delivery、Codex E2E 脚本
- 当前仓库运行：
  - `node packages/cli/bin/agent-harness.js status`
  - `node packages/cli/bin/agent-harness.js verify --task-id p14-dot-harness-runtime-migration`
  - `node packages/cli/bin/agent-harness.js delivery ready --task-id p14-dot-harness-runtime-migration`
- 临时仓库验证：
  - `init --host codex --rules base` 默认生成 `.harness/...`
  - 已存在 `AGENTS.md` 时追加 managed block，不覆盖原内容
