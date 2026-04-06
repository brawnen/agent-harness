# ADR: 收口 Claude Code 宿主接入，使 init/status/adapter/docs 口径一致并可在其他项目初始化出可检查的 Claude Code hooks 配置

## 状态

Proposed

## 背景

- task_id: `feature----2e20df`
- intent: `feature`
- risk_level: `medium`
- goal: 收口 Claude Code 宿主接入，使 init/status/adapter/docs 口径一致并可在其他项目初始化出可检查的 Claude Code hooks 配置

## 决策

- 将 `packages/protocol/adapters/claude-code/hooks.json` 从“未来态示例”收口为当前 `init --host claude-code` 实际使用的模板。
- Claude Code hooks 命令统一改为 `npx @brawnen/agent-harness-cli ...`，避免模板依赖宿主环境里预先存在裸 `agent-harness` 命令。
- `status` 对 Claude Code hooks 的检查同步兼容 `@brawnen/agent-harness-cli gate before-tool` 和 `@brawnen/agent-harness-cli state update` 这两类命令形态。
- README、使用指南和 `CLAUDE.md` 不再把 Claude Code 口径描述为纯 future work，而是明确当前能力边界：已支持 `CLAUDE.md + PreToolUse / PostToolUse` 的最小闭环，但仍没有类似 Codex 的 `SessionStart / UserPromptSubmit` 自动 intake 能力。
- `AGENTS.md` 同步新增项目级协作偏好，规定 Claude Code 宿主接入类任务默认由 agent 自主推进，只有高风险、超 scope、需要外部权限或不可逆操作时才追问用户。

## 后果

- 正面影响：`init --host claude-code` 生成的 hooks 配置与当前 CLI 能力一致，`status` 能正确识别，文档口径与实现不再冲突，项目内关于 Claude Code 接入任务的协作方式也被明确固化。
- 代价与风险：`npx @brawnen/agent-harness-cli ...` 作为 hook 命令会把运行时可用性部分交给 `npx`；如果目标环境缺少 Node/npm 或禁止 `npx`，仍需要用户改为项目内安装或其他本地命令入口。

## 影响范围

- packages/cli/src/commands/init.js
- packages/cli/src/commands/status.js
- packages/protocol/adapters/claude-code/hooks.json
- packages/protocol/adapters/claude-code/rules-injection.md
- README.md
- AGENTS.md
- docs/2026-04-05-agent-harness-usage-guide-v0.1.md
- CLAUDE.md
- CHANGELOG.md
- docs/feature-claude-code-adapter-2e20df-design-note.md
