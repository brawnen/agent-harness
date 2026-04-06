# Design Note: 收口 Claude Code 宿主接入，使 init/status/adapter/docs 口径一致并可在其他项目初始化出可检查的 Claude Code hooks 配置

## 背景

- task_id: `feature----2e20df`
- intent: `feature`
- risk_level: `medium`

## 目标

- 收口 Claude Code 宿主接入，使 init/status/adapter/docs 口径一致并可在其他项目初始化出可检查的 Claude Code hooks 配置

## 作用范围

- packages/cli/src/commands/init.js
- packages/cli/src/commands/status.js
- packages/protocol/adapters/claude-code/hooks.json
- packages/protocol/adapters/claude-code/rules-injection.md
- README.md
- docs/2026-04-05-agent-harness-usage-guide-v0.1.md
- CLAUDE.md

## 方案

- 把 `claude-code` adapter 模板里的 hook 命令统一切到 `npx @brawnen/agent-harness-cli ...`，让 `init --host claude-code` 生成的 `.claude/settings.json` 至少指向正确的 CLI 包入口。
- 保持 `init` 的现有合并逻辑不变，只收口生成内容与对外说明，避免把本次任务扩大成 package manager 或依赖安装策略重构。
- 扩展 `status` 的 Claude Code hooks 检查逻辑，使其既能识别旧的 `agent-harness ...` 命令，也能识别新的 `@brawnen/agent-harness-cli ...` 命令。
- 更新 README、使用指南和仓库内 `CLAUDE.md`，把 Claude Code 的支持边界写清楚：当前支持工具级 `PreToolUse / PostToolUse`，但不支持 Codex 那种 response-level 自动 intake。
- 在 `AGENTS.md` 中补充项目级协作偏好，让 Claude Code 宿主接入任务默认按“agent 自主推进、仅在高风险或硬边界时追问”执行。

## 风险与权衡

- 选择 `npx @brawnen/agent-harness-cli ...` 而不是裸 `agent-harness ...`，优点是生成配置指向正确包名；代价是 hook 运行时会依赖 `npx` 可用。
- 不在这次任务里自动修改目标项目的 `package.json` 或锁文件，优点是避免高摩擦依赖管理改动；代价是“最稳定运行方式”仍需要项目显式安装 CLI。
- 文档同步收口能避免用户把 Claude Code 当作“仍未接入”；代价是需要持续维护“已支持但边界有限”的表述，不得误写成与 Codex 同等级能力。
- 把协作偏好写入 `AGENTS.md` 能减少后续实现类任务的沟通摩擦；代价是该规则属于项目默认策略，后续若要改变节奏，需要显式覆盖。

## 验证计划

- `node --check packages/cli/src/commands/status.js`
- 在临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js init --host claude-code`
- 检查生成的 `.claude/settings.json` 是否包含 `npx @brawnen/agent-harness-cli gate before-tool` 和 `npx @brawnen/agent-harness-cli state update`
- 在临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js status`，确认 `.claude/settings.json` 检查通过
- `rg -n 'Claude Code 宿主接入|默认由 agent 自行完成方案、实现、验证与收口' AGENTS.md`
