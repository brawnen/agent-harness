# Hook 架构审计与 Gemini CLI 接入方案

> 日期：2026-04-07
> 状态：执行中
> 目标读者：Codex / 执行 agent

---

## 1. 收敛结论

### 1.1 已确认事实

- `Codex` 官方 hooks 已支持 `SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop`
- `Codex` 的 `additionalContext` 注入协议可用，`writeContinue()` 输出空 `{}` 是 correctness 问题，不是协议限制
- `Gemini CLI` 已支持原生 hooks，当前项目不应再把它描述为“仅有 GEMINI.md + CLI 的手动模式”
- `Codex` 未启用 `PreToolUse / PostToolUse` 不是单纯漏配，而是当前仓库基于视觉噪音做的有意权衡

### 1.2 本轮执行策略

先做 `hook core + host io adapter` 重构，再在新内核上接入 Gemini CLI hooks。

不把以下事项绑进第一轮：

- 三端外层目录结构完全统一
- Codex repo-local wrapper 全量删除
- `init / status / README / AGENTS / GEMINI` 之外的全面文档翻新
- 因“更统一”而重开 Codex `PreToolUse / PostToolUse`

---

## 2. 当前覆盖矩阵

| Hook 事件 | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| `SessionStart` | 已接入 | 已接入 | 已接入 |
| `Prompt / Agent Submit` | `UserPromptSubmit` | `UserPromptSubmit` | `BeforeAgent` |
| `BeforeTool` | 已接入 | 有实现但默认不启用 | 已接入 |
| `AfterTool` | 通过 `state update` 接入 | 有实现但默认不启用 | 已接入 |
| `Completion Gate` | `Stop` | 核心已具备，默认不启用 | `AfterAgent` |

### Codex 特殊说明

- `.codex/hooks.json` 当前只启用 `SessionStart / UserPromptSubmit`
- `PreToolUse / PostToolUse` 继续保持关闭，原因是宿主 hook 生命周期提示带来明显视觉噪音
- 但相关逻辑仍应保持可运行，不能处于“文件在、逻辑坏”的状态

### Gemini CLI 特殊说明

- Gemini 使用 `.gemini/settings.json`
- 事件命名与 Claude/Codex 不完全一致，因此需要宿主 IO adapter，而不是直接复用事件壳子

---

## 3. 本轮前的关键问题

### P0：Codex continue 路径丢失 additionalContext

**文件**：`.codex/hooks/shared/codex-hook-io.js`

旧实现把所有 continue 路径都输出为空 `{}`，导致：

- active task 恢复上下文不会注入
- prompt intake 结果不会注入
- fallback additionalContext 也不会注入

这属于真实 correctness bug，必须修复。

### P1：Claude / Codex prompt hook 存在重复实现

重复逻辑主要集中在：

- override / manual confirmation 记录
- pending confirmation 判定
- risk level 推导
- prompt/cwd 解析与 continue/block 结果拼装

风险不是“代码难看”，而是宿主行为分叉。

### P1：Gemini 适配层缺失

缺的不是业务核心，而是三块宿主外壳：

- `.gemini/settings.json` 模板
- `hook gemini <event>` CLI 路由
- `status / init / docs` 对 Gemini hooks 的识别

---

## 4. 目标架构

### 4.1 核心分层

```
宿主配置
  -> hook entry
    -> host io adapter
      -> hook core
        -> task-core / state-store / gate / verify
```

### 4.2 模块职责

#### hook core

宿主无关，只处理语义：

- `SessionStart`
- `PromptSubmit / BeforeAgent`
- `CompletionGate`
- `BeforeTool`
- `AfterTool`

#### host io adapter

宿主相关，只处理：

- stdin payload 解析
- 字段归一化
- stdout 协议格式化
- 事件名映射

#### thin entrypoint

- Claude: `agent-harness.js hook claude <event>`
- Gemini: `agent-harness.js hook gemini <event>`
- Codex: 保留 repo-local wrapper，但 wrapper 只做薄转发

---

## 5. 分阶段执行顺序

### Phase 1：收敛内核

1. 抽 `hook-core.js`
2. 抽 `hook-io/shared.js`
3. 抽 `hook-io/claude.js / codex.js / gemini.js`
4. 改写 `claude-hooks.js`
5. 把 Codex wrapper 改成 thin wrapper

### Phase 2：接入 Gemini CLI hooks

1. 新增 `packages/protocol/adapters/gemini-cli/hooks.json`
2. 新增仓库级 `.gemini/settings.json`
3. 扩展 `packages/cli/src/commands/hook.js`
4. 扩展 `init --host gemini-cli`
5. 扩展 `status`

### Phase 3：文档与规则收口

1. 更新本设计文档
2. 更新 `README.md`
3. 更新 `AGENTS.md`
4. 更新 `GEMINI.md`
5. 更新 Gemini adapter 说明

---

## 6. 非目标

本轮不做：

- 强行统一 Codex / Claude / Gemini 的外层配置文件形态
- 因为“架构更完整”就默认启用 Codex `PreToolUse / PostToolUse`
- 全量重写 `state update` 的 Claude PostTool 策略
- 把所有 tool output 都当 evidence 写入 state

---

## 7. 相关文件

### 核心

- `packages/cli/src/lib/hook-core.js`
- `packages/cli/src/lib/hook-io/shared.js`
- `packages/cli/src/lib/hook-io/claude.js`
- `packages/cli/src/lib/hook-io/codex.js`
- `packages/cli/src/lib/hook-io/gemini.js`

### 宿主适配

- `packages/cli/src/lib/claude-hooks.js`
- `packages/cli/src/lib/codex-hooks.js`
- `packages/cli/src/lib/gemini-hooks.js`
- `packages/cli/src/commands/hook.js`

### 宿主配置

- `.claude/settings.json`
- `.codex/hooks.json`
- `.gemini/settings.json`
- `packages/protocol/adapters/claude-code/hooks.json`
- `packages/protocol/adapters/gemini-cli/hooks.json`

### 规则与状态机

- `packages/cli/src/commands/gate.js`
- `packages/cli/src/commands/status.js`
- `packages/cli/src/commands/init.js`
- `packages/cli/src/lib/task-core.js`
- `packages/cli/src/lib/state-store.js`
- `packages/cli/src/lib/audit-store.js`
