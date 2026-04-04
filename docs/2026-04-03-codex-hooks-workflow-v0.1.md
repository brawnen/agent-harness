# Codex Hooks 开发流接入说明 v0.1

## 目标

将当前仓库内置的 `.codex/hooks.json` 正式纳入日常开发流，让 Codex 在进入会话和提交 prompt 时自动接入 `agent-harness` 的最小任务状态机。

## 当前仓库已内置的内容

- `.codex/hooks.json`
- `.codex/hooks/user_prompt_submit_intake.js`
- `.codex/hooks/session_start_restore.js`
- `.codex/hooks/shared/codex-hook-io.js`

这些文件已经通过真实 Codex 会话验证，能够在仓库内自动创建或恢复最小 task state。

## 启用方式

当前仓库已通过 `.codex/config.toml` 默认设置：

```toml
[features]
codex_hooks = true
```

因此在 trusted project 场景下，直接启动即可：

```bash
codex
```

或：

```bash
codex exec "任务描述"
```

如果需要显式覆盖，也可以继续使用：

```bash
codex --enable codex_hooks
```

一次性执行：

```bash
codex exec --enable codex_hooks "任务描述"
```

说明：

- 使用前需要本机安装 `codex`
- 当前仓库默认通过项目级配置启用 `codex_hooks`
- 若项目未被 Codex 视为 trusted project，仍需显式启用 `codex_hooks`
- repo-local hooks 依赖当前仓库是 git repo，因为 hooks 配置中使用了 `$(git rev-parse --show-toplevel)`
- trusted project 场景下默认读取 `.codex/config.toml`
- untrusted project 场景下项目级配置可能不生效，此时应显式使用 `codex --enable codex_hooks`

## 自动行为

### SessionStart

- 尝试读取 `harness/state/index.json`
- 若存在 active task，则把任务摘要注入回当前会话上下文

### UserPromptSubmit

- 若当前无 active task，则自动创建新 task
- 若当前输入被判定为当前任务续写，则保留现有 active task
- 若当前输入被判定为新任务，则自动挂起旧任务并创建新 task
- 若当前输入高风险且归属不明，则直接 block 本轮 prompt

## 推荐开发流

1. 在当前仓库中直接用 `codex` 启动会话
2. 直接输入自然语言任务，不需要先手写 task draft
3. 若 Codex 自动创建了错误的任务归属，再用 CLI 手动纠正
4. 需要完成闭环时，继续使用 `verify` / `report`

## 手动 fallback

自动 intake 不应成为唯一入口。以下场景建议手动 fallback：

- `codex_hooks` 未启用
- 自动判定把 follow-up 误判成新任务
- 需要显式挂起当前任务再切题
- 需要在非 Codex 宿主下补录任务

常用命令：

```bash
node packages/cli/bin/agent-harness.js task intake "任务描述"
node packages/cli/bin/agent-harness.js task suspend-active --reason "切换到新问题"
node packages/cli/bin/agent-harness.js state active
node packages/cli/bin/agent-harness.js verify --task-id <task-id>
node packages/cli/bin/agent-harness.js report --task-id <task-id> --conclusion "结论"
```

统一降级提示：

- `SessionStart` / `UserPromptSubmit` hook 失败时会 fail-open
- 提示文案会明确标注“已降级到手动模式”
- 提示中会直接附带最小 fallback 命令

## 当前边界

- 当前 `continue / new / clarify` 判定仍是最小 heuristics
- 复杂上下文、多轮切题和跨文件大任务仍可能误判
- hook 只负责最小 intake 与恢复，不负责完整执行门禁
- Claude Code / Gemini CLI 仍未接入同等级自动化 hooks

## 仓库内自检

```bash
npm run codex:hooks:check
npm run codex:hooks:status
npm run codex:e2e
```

- `codex:hooks:check` 只校验 hook 脚本语法，不等价于真实宿主验证。
- `codex:hooks:status` 会检查当前仓库的 `.codex/config.toml`、`.codex/hooks.json` 和关键 hook 命令是否齐备。
- `codex:e2e` 会在当前 trusted 仓库中执行一条真实 `codex exec` smoke，并对 `UserPromptSubmit` / 降级路径做 hook 级回归，同时清理自己创建的 task/audit/report 文件。
