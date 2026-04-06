# Design Note: 为 Claude Code 实现 SessionStart + UserPromptSubmit + Stop 三件套，使 Claude 宿主更接近 agent-native。

## 背景

- task_id: `feature---claude-4f4600`
- intent: `feature`
- risk_level: `low`

## 目标

- 为 Claude Code 实现 SessionStart + UserPromptSubmit + Stop 三件套，使 Claude 宿主更接近 agent-native。

## 作用范围

- packages/cli/**
- packages/protocol/adapters/claude-code/**
- .claude/settings.json
- README.md
- README.en.md
- docs/**
- CLAUDE.md
- AGENTS.md

## 方案

- 在 CLI 中新增 `hook claude <session-start|user-prompt-submit|stop>` 入口，统一承接 Claude Code 的 response/session 级 hook 调用。
- 新增 `packages/cli/src/lib/claude-hooks.js`，把 Claude `SessionStart`、`UserPromptSubmit`、`Stop` 的核心逻辑收敛为可复用的本地处理函数。
- `SessionStart` 负责恢复 active task 摘要，并通过 `additionalContext` 注入给 Claude。
- `UserPromptSubmit` 复用现有 harness 自动 intake 逻辑，支持自动创建任务、continue/clarify 判断，以及 override / manual confirmation 记录。
- `Stop` 先按“完成宣告门禁”实现：仅当模型明显宣称任务已完成时，检查 active task 是否已满足 verify / report 收口；若未满足则阻止 stop。
- 跨项目模板 `packages/protocol/adapters/claude-code/hooks.json` 升级到五个事件：`SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`。
- 当前仓库自举使用的 `.claude/settings.json` 走 repo-local `node "$CLAUDE_PROJECT_DIR/packages/cli/bin/agent-harness.js" ...`，避免自举链路依赖已发布 npm 版本。
- `status` 同时兼容检查两种命令形态：跨项目模板的 `npx @brawnen/agent-harness-cli ...` 与当前仓库的 repo-local `node .../packages/cli/bin/agent-harness.js ...`。

## 风险与权衡

- `Stop` 当前是启发式完成门禁，只在模型明显宣称“已完成”时触发，不会对所有自然语言回复做全面语义审查。
- 若模型在被 `Stop` 阻断后仍持续给出无效完成宣告，理论上存在重复 stop-block 风险；当前先以明确 reason 驱动模型自修正，后续可再评估更细的循环保护。
- 当前仓库根目录的 `CLAUDE.md`、`AGENTS.md`、`GEMINI.md` 仍不是 managed block 形态，`status` 里的对应失败提示属于既有仓库状态，不是本次 Claude hooks 新引入的问题。
- 维持“模板用 `npx`、当前仓库用 repo-local `node`”会带来两种命令形态，但这是跨项目安装稳定性与当前仓库自举一致性之间更合理的折中。

## 验证计划

- `node --check packages/cli/src/lib/claude-hooks.js`
- `node --check packages/cli/src/commands/hook.js`
- `node --check packages/cli/src/index.js`
- `node --check packages/cli/src/commands/status.js`
- 在临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js init --host claude-code`
- 在同一临时目录执行 `node /Users/lijianfeng/code/pp/agent-harness/packages/cli/bin/agent-harness.js status`
- 以合成 hook payload 验证 `SessionStart / UserPromptSubmit / Stop` 的 JSON 输出
