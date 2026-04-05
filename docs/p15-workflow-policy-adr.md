# ADR: 为 agent-harness 增加 full/lite workflow_policy 的自动推荐、升级与展示能力

## 状态

Proposed

## 背景

- task_id: `p15-workflow-policy`
- intent: `refactor`
- risk_level: `low`
- goal: 为 agent-harness 增加 full/lite workflow_policy 的自动推荐、升级与展示能力

## 决策

- 引入 `workflow_policy`，将任务流程模式显式分成 `full` 与 `lite`。
- 第一版只实现 `recommend` 模式，不将其直接接成新的强制门禁。
- 系统允许根据真实改动范围与输出工件要求，将任务从 `lite` 升级为 `full`。
- 系统不允许自动从 `full` 降级为 `lite`。

## 后果

- 正面影响：`task intake / confirm / status / report / delivery` 现在都可以共享并展示统一的 `workflow_decision`。
- 代价与风险：第一版仍然偏保守，`docs-only` 和 `no_behavior_change` 的判断可能宁可升到 `full`。

## 影响范围

- packages/cli/src/lib/workflow-policy.js
- packages/cli/src/lib/project-config.js
- packages/cli/src/lib/state-store.js
- packages/cli/src/lib/task-core.js
- packages/cli/src/commands/task.js
- packages/cli/src/commands/status.js
- packages/cli/src/commands/report.js
- packages/cli/src/commands/delivery.js
- packages/cli/src/commands/init.js
- harness.yaml
- README.md
- README.en.md
- docs/2026-04-05-workflow-policy-design-v0.1.md
