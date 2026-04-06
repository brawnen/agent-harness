# Design Note: 收口 Codex hooks 降噪改动与可见性规范文档，保留核心 hooks 能力并达到可提交状态

## 背景

- task_id: `feature--codex-hooks-2993ed`
- intent: `feature`
- risk_level: `medium`

## 目标

- 收口 Codex hooks 降噪改动与可见性规范文档，保留核心 hooks 能力并达到可提交状态

## 作用范围

- .codex/hooks.json
- .codex/hooks/pre_tool_use_gate.js
- .codex/hooks/shared/codex-hook-io.js
- .codex/hooks/user_prompt_submit_intake.js
- README.md
- docs/2026-04-06-codex-hook-visibility-policy-v0.1.md

## 方案

- `.codex/hooks.json` 保留四个核心 hook，但移除每个 hook 的 `statusMessage`，避免 repo-local 文案继续放大前台提示。
- `.codex/hooks/shared/codex-hook-io.js` 中的 `writeContinue()` 固定返回 `{}`，把 continue 路径视为纯控制面动作，不向前台暴露额外业务说明。
- `.codex/hooks/user_prompt_submit_intake.js` 与 `.codex/hooks/pre_tool_use_gate.js` 的 block 文案统一收敛为最小必要提示，避免把内部判断细节直接抛给用户。
- `.codex/hooks/pre_tool_use_gate.js` 增加只读 Bash 快速判断，覆盖常见只读命令和只读 `git` 子命令，避免对无副作用命令执行完整 gate。
- 通过新增文档把“控制面 vs 对话面”的可见性边界显式写出来，并从 README 建立入口。

## 风险与权衡

- 不移除 hook，而只做可见性收敛，可以保留 agent-native 能力闭环；代价是宿主层仍可能显示固定的 hook 生命周期提示。
- 只对高置信只读 Bash 做快速放行，避免误把复杂 shell 语法当作只读命令；代价是覆盖范围保持保守，复杂命令仍会走原门禁。
- 把可见性规范单独成文，能形成后续评审基线；代价是新增了需要持续维护的产品规则文档。

## 验证计划

- `node --check .codex/hooks/pre_tool_use_gate.js`
- `node --check .codex/hooks/shared/codex-hook-io.js`
- `node --check .codex/hooks/user_prompt_submit_intake.js`
- `node packages/cli/bin/agent-harness.js status`
