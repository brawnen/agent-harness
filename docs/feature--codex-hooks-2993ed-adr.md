# ADR: 收口 Codex hooks 降噪改动与可见性规范文档，保留核心 hooks 能力并达到可提交状态

## 状态

Proposed

## 背景

- task_id: `feature--codex-hooks-2993ed`
- intent: `feature`
- risk_level: `medium`
- goal: 收口 Codex hooks 降噪改动与可见性规范文档，保留核心 hooks 能力并达到可提交状态

## 决策

- 保留 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse` 四个核心 Codex hooks，不因为“前台噪音”问题移除核心 agent-native 能力。
- 移除 `.codex/hooks.json` 中的自定义 `statusMessage`，将 hook 生命周期提示的可见性问题收敛为宿主展示层问题，而不是业务文案问题。
- 将 `writeContinue()` 统一收敛为输出空对象，避免 continue 路径把额外上下文暴露到前台。
- 对 `PreToolUse` 增加高置信只读 Bash 快速放行，减少对 `pwd`、`ls`、`rg`、只读 `git` 等命令的不必要门禁开销。
- 用独立规范文档明确“hook 属于控制面、用户默认只看结论与决策请求”的产品边界。

## 后果

- 正面影响：保留了 Codex hooks 作为 agent-native 控制面的完整能力，同时减少了 repo-local 文案层面的可见噪音，并降低了只读 Bash 命令的门禁摩擦。
- 代价与风险：宿主若仍显示 `Running ... hook`，该提示依旧存在，因为这是 Codex 展示层约束，不是 repo-local hooks 能完全消除的问题；同时，`writeContinue()` 不再传递额外上下文后，后续若需要继续向模型注入上下文，需要走新的宿主能力或其他接入方式。

## 影响范围

- .codex/hooks.json
- .codex/hooks/pre_tool_use_gate.js
- .codex/hooks/shared/codex-hook-io.js
- .codex/hooks/user_prompt_submit_intake.js
- README.md
- docs/2026-04-06-codex-hook-visibility-policy-v0.1.md
- docs/feature--codex-hooks-2993ed-design-note.md
- CHANGELOG.md
