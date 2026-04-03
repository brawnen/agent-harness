# Harness Agent-Native Integration 可行性分析 v0.1

## 1. 分析结论

这份规范的方向是对的，但核心假设"行为硬门禁"在当前主流 agent 平台上无法真正实现。

规范本身是一个理想目标定义，不是一个可直接落地的实现规范。可以实现大约 70% 的设计意图，但那关键的 30%（硬门禁）需要降级策略或等平台能力演进。

一句话判断：

`agent-native 是正确方向，但落地需要一份"实现约束文档"来补齐理想与现实的差距。`

## 2. 分析对象

本文基于以下文档进行可行性分析：

- [agent-native integration 规范](/Users/lijianfeng/code/pp/harness/harness/2026-04-01-harness-agent-native-integration-spec-v0.1.md)
- [主设计稿](/Users/lijianfeng/code/pp/harness/harness/2026-03-31-project-harness-design-v0.1.md)
- [intake / interaction 规范](/Users/lijianfeng/code/pp/harness/harness/2026-04-01-harness-intake-interaction-spec-v0.1.md)
- [intake CLI 规范](/Users/lijianfeng/code/pp/harness/harness/2026-04-01-harness-intake-cli-spec-v0.1.md)
- [task-draft.schema.json](/Users/lijianfeng/code/pp/harness/harness/schemas/task-draft.schema.json)
- [intake-result.schema.json](/Users/lijianfeng/code/pp/harness/harness/schemas/intake-result.schema.json)

## 3. 能实现的部分

### 3.1 Intake / Clarify 层 — 完全可行

自然语言到 Task Draft 的推断、缺口识别、单问题追问，本质是 prompt engineering + structured output。

当前 LLM 已经足够好，通过 system prompt + schema 约束就能做到。intake-interaction 规范和 CLI 规范已经把这块定义得很清楚。

没有技术障碍，可以立即开始实现。

### 3.2 Task Contract / State Model — 完全可行

JSON/YAML schema 已经定义好，对象模型、状态枚举、迁移规则都清晰。这是纯数据结构问题，不存在平台依赖。

### 3.3 Reference CLI — 完全可行

`harness task intake "<input>"` 输出结构化 JSON，这就是一个普通的命令行工具。

### 3.4 用户只和 agent 交互 — 基本可行

通过 CLAUDE.md / AGENTS.md 注入 harness 行为规则，用户感知不到 harness 存在。这已经是当前的最佳实践。

### 3.5 Skill Adapter 选择 — 可行

match -> validate -> score -> select 的四步选择逻辑是确定性的，不依赖 LLM 能力。

## 4. 核心难点：硬门禁 vs 软约束

这是整份规范最理想化的地方。

### 4.1 规范的要求

规范第 10 节明确说：

> "这是 native integration 的关键，不可退化为'建议'"

规范第 14 节的成功标准中，第 4、5、6 条都要求"禁止"或"无法"：

- 未闭合时，agent 无法直接执行
- 高风险时，agent 必须要求确认
- 未验证时，agent 无法宣称完成

并且明确指出：

> "只要缺少第 4、5、6 中任意一项，就仍然只是'软约束工具'，而不是 native harness。"

### 4.2 当前平台的实际能力

| 平台 | 拦截机制 | 能力边界 |
|---|---|---|
| Claude Code | `PreToolUse` hook（shell 命令） | 只能按工具名和参数做简单拦截，无法判断"task contract 是否闭合" |
| Codex | AGENTS.md 指令 | 纯 prompt 约束，LLM 可以忽略 |
| Gemini CLI | 系统指令 | 纯 prompt 约束，LLM 可以忽略 |

### 4.3 三个具体不可行点

#### 4.3.1 没有平台提供语义级 before_execute 拦截

规范定义的 `before_plan`、`before_execute`、`before_completion` 都需要语义级判断（"intent/goal/scope/acceptance 是否闭合"），但现有平台的 hook 机制只支持字符串级匹配。

要做到语义级拦截，需要一个独立的 harness 进程来维护状态并执行判断。这意味着 hook 调用链变成：

`agent 准备执行 -> 平台 hook 触发 -> shell 调用 harness CLI -> harness 读取 state 判断 -> 返回 allow/block`

这在技术上可行，但引入了进程间通信、状态同步、延迟等复杂性，远超规范描述的"内部内核"的简洁形态。

#### 4.3.2 LLM 是概率性的，无法保证服从

即使 prompt 写得再好，LLM 仍然可能：

- 在长上下文中遗忘 harness 规则
- 自行判断条件已满足（实际未满足）
- 在复杂任务中跳过 clarify 直接执行

规范说的"agent 必须服从控制信号"在 prompt-based 架构下做不到"必须"。

#### 4.3.3 `before_agent_reply` 在当前平台不存在

这个 hook 要求在 LLM 生成回复之前拦截。当前没有任何主流 agent 平台暴露这个能力。Claude Code 的 hooks 是 tool-level 的，不是 response-level 的。

## 5. 降级策略：三级门禁模型

规范不是"太理想"，而是需要分层策略来应对现实约束。

### 5.1 三级门禁定义

| 级别 | 名称 | 机制 | 实现方式 | 约束强度 |
|---|---|---|---|---|
| L1 | 硬门禁 | 平台原生拦截 | Claude Code PreToolUse hook + 外部 harness 进程 | 不可绕过 |
| L2 | 协议门禁 | 结构化 prompt + 输出校验 | system prompt 注入 + 输出 schema 校验 + 违规检测 | 高概率服从 |
| L3 | 观察门禁 | 事后审计 | after_execute 记录 + 违规标记 + 人工 review | 事后追溯 |

### 5.2 当前可达水平

当前能做到 L2 + L3。

L1 需要等平台能力演进，或自建 agent runtime。

### 5.3 各钩子的现实可达级别

| 钩子 | 规范要求 | 当前可达 | 差距说明 |
|---|---|---|---|
| `on_user_input` | 自动触发 intake | L2（prompt 规则） | 可行，通过 system prompt 约束 |
| `before_agent_reply` | 拦截回复 | 不可达 | 无平台支持 response-level hook |
| `before_plan` | 闭合检查 | L2（prompt 规则） | LLM 自行判断，无法硬拦截 |
| `before_execute` | 执行门禁 | L1（部分）+ L2 | PreToolUse 可做工具级拦截，但无法做语义级判断 |
| `after_execute` | 状态更新 | L1（可行） | PostToolUse hook 已支持 |
| `before_completion` | 完成门禁 | L2（prompt 规则） | LLM 自行判断，无法硬拦截 |

### 5.4 降级策略的设计要求

规范应对每个控制信号声明：

- 该信号属于 L1、L2 还是 L3
- 当 L1 不可用时，L2 的 fallback 行为是什么
- 违规时的审计和补救机制

## 6. 规范缺失项

### 6.1 状态持久化与恢复机制

规范说"agent 内部维护结构化状态"，但没定义：

- 状态存在哪里？内存、文件、还是 agent 上下文？
- 会话中断后如何恢复？
- 上下文被压缩后状态丢失怎么办？

建议：

定义 `harness/state/` 目录，task state 落盘为 JSON 文件。每次 hook 触发时读写。文件命名按 `task_id` 组织。agent 启动时自动读取未完成任务的 state。

### 6.2 多任务与任务切换

规范只覆盖单任务生命周期。现实中用户会：

- 中途切换任务
- 同时提到多个问题
- 在一个任务进行中给出新约束

建议补充：

- `task_id` 管理协议
- 任务挂起/恢复机制
- 任务切换时的 state 保存规则
- 新输入是否属于当前任务的判定规则

### 6.3 降级与容错策略

当前缺失以下场景的处理规则：

- 当 agent 违反门禁（比如直接执行了未闭合的任务），怎么办？
- 当 harness core 判断错误（误判为 block），怎么回退？
- 当用户明确说"不管了直接做"，如何 override？

建议补充：

- `force_override` 控制信号：用户显式跳过门禁，但记录到审计日志
- 违规审计日志格式
- harness 误判的申诉机制（用户说"我确认过了，继续"）

### 6.4 控制信号的产生机制

规范定义了 9 个控制信号，但没定义谁来产生这些信号、用什么逻辑产生。

三种可能路径：

| 路径 | 优点 | 缺点 |
|---|---|---|
| LLM 自行根据 prompt 判断 | 简单，不需要额外进程 | 回到软约束，不可靠 |
| 确定性代码根据 state 判断 | 可靠，可做硬门禁 | 需要独立 harness 进程，复杂度高 |
| 混合：确定性判断 + LLM 语义判断 | 平衡可靠性和灵活性 | 需要明确定义边界 |

建议：

把控制信号分为两类：

- 确定性信号：由代码产生，可做硬门禁
  - 必填字段是否存在 -> `block_plan` / `proceed_to_plan`
  - risk_rules 是否命中 -> `require_confirmation`
  - evidence 是否挂载 -> `block_completion` / `allow_completion`
- 语义性信号：由 LLM 判断，只能做 L2 约束
  - scope 是否足够具体 -> `ask_one_question`
  - acceptance 是否可执行 -> `ask_one_question`
  - 执行是否越出 scope -> `block_execution`

### 6.5 Host Adapter 的最小接口契约

规范说 adapter "不得重新定义核心"，但没给 adapter 一个最小接口定义。

建议补充 adapter 必须实现的接口：

```
interface HostAdapter {

  // 生命周期映射
  onUserInput(input: string): IntakeResult
  beforeToolCall(tool: string, args: any): GateResult
  afterToolCall(tool: string, result: any): void

  // 状态管理
  getState(): HarnessState
  setState(state: HarnessState): void
  persistState(): void
  restoreState(taskId: string): HarnessState

  // 平台能力声明
  capabilities(): AdapterCapabilities
}

interface AdapterCapabilities {
  canInterceptToolCall: boolean
  canInterceptResponse: boolean
  canPersistState: boolean
  canRunExternalProcess: boolean
  gateLevel: "L1" | "L2" | "L3"
}
```

没有这个，每个 adapter 的实现者会各自理解"映射"的含义。

`capabilities()` 的作用是让 harness core 知道当前 adapter 能做到什么级别的门禁，从而自动降级。

### 6.6 验证门禁的具体规则

规范说"没有满足最小验证要求不能宣称完成"，但没定义：

- 不同 intent 的最小验证要求是什么？
- evidence 的格式和有效性判断标准？
- "验证通过"的判定是 LLM 判断还是程序判断？

建议按 intent 定义最小验证矩阵：

| intent | 最小验证要求 | 判定方式 |
|---|---|---|
| bug | 至少一条 `command_result` 或 `test_result` 证明问题不再复现 | 确定性（退出码） |
| feature | 至少一条 `command_result` 证明新能力可运行 | 确定性（退出码） |
| explore | 至少一条 `reasoning_note` 包含结论和依据 | 语义性（LLM 判断） |
| refactor | 至少一条 `test_result` 证明行为不变 | 确定性（退出码） |
| prototype | 无强制验证，但必须标注"未验证" | 标记即可 |

### 6.7 与现有 CLAUDE.md / AGENTS.md 的集成方式

规范是平台无关的，但缺少一个具体的参考实现来说明：

- 如何把 harness 规则注入到 CLAUDE.md
- harness state 文件如何与 agent 上下文同步
- 哪些规则写在 system prompt 里，哪些通过 hook 执行

建议补充一份 `Claude Code Adapter 参考实现` 文档，至少覆盖：

- CLAUDE.md 中需要注入的 harness 行为指令
- `.claude/settings.json` 中需要配置的 hooks
- harness CLI 的调用时机和参数传递

### 6.8 性能与延迟

运行 harness 评估会增加每次 agent 动作的延迟。规范没有讨论：

- hook 调用的延迟预算是多少？
- 如果 harness CLI 响应过慢，是放行还是阻断？
- 哪些 hook 可以异步执行（如 after_execute），哪些必须同步（如 before_execute）？

## 7. 建议实现路径

不建议按规范的 Phase 1->4 线性推进，建议改为：

### 7.1 第一步：Prompt-Native Harness（现在就能做）

用 CLAUDE.md + system prompt 实现 L2 协议门禁。

把 intake 规则、clarify policy、控制信号语义写成 agent instructions。相当于"prompt-native harness"。

产出：

- 一份 harness 行为指令的 CLAUDE.md 模板
- 可直接用于日常开发

价值：

- 验证 intake/clarify 流程是否有效
- 零额外工具依赖
- 立即获得反馈

### 7.2 第二步：CLI + 确定性门禁

harness 作为独立进程，负责 state 管理和确定性信号。

通过 Claude Code 的 `PreToolUse` hook 调用 harness CLI 做拦截。

产出：

- harness CLI（intake + state 管理 + 确定性门禁判断）
- Claude Code hook 配置

价值：

- 确定性信号升级到 L1
- state 持久化落地
- 开始积累审计数据

### 7.3 第三步：数据驱动优化

跑真实任务，用 after_execute 审计日志统计：

- agent 违反门禁的频率
- 哪些 clarify 问题真的有用
- 哪些门禁过于保守导致用户频繁 override

用数据决定哪些地方需要加强约束，哪些需要放松。

### 7.4 第四步：平台能力跟进

根据平台能力演进（比如 Claude Code 如果开放 response-level hooks 或语义级拦截），逐步把 L2 约束升级到 L1。

## 8. 总结评估

| 维度 | 评价 | 说明 |
|---|---|---|
| 方向 | 正确 | agent-native 是唯一正确方向 |
| 对象模型 | 完整 | schema 已可用 |
| 生命周期设计 | 合理 | 钩子定义清晰 |
| 控制信号 | 语义清楚 | 但缺少产生机制 |
| 硬门禁假设 | 过于理想 | 当前平台不支持语义级硬拦截 |
| 降级策略 | 缺失 | 这是最需要补充的一项 |
| 多任务 / 持久化 | 缺失 | 单任务模型不够覆盖真实使用 |
| Host Adapter 接口 | 缺失 | 只有职责描述没有契约定义 |
| 验证规则 | 缺失 | 没有按 intent 定义最小验证矩阵 |
| 集成参考实现 | 缺失 | 从规范到落地有空白 |

### 8.1 最终判断

这份规范作为目标架构文档是合格的，方向判断准确，对象设计干净。

但要从"目标架构"变成"可落地实现"，需要补一份实现约束文档，回答：

- 在当前平台能力下，哪些做硬的，哪些做软的，哪些先不做
- 状态存在哪里，怎么恢复
- 多任务怎么管理
- adapter 的最小接口是什么
- 验证的最小标准是什么

只有把这些补齐，规范才能从"正确但理想"变成"正确且可执行"。

## 9. 与现有设计文档的关系

这份分析是对 agent-native integration 规范的补充评估：

- [主设计稿](/Users/lijianfeng/code/pp/harness/harness/2026-03-31-project-harness-design-v0.1.md) 回答"harness 有哪些对象"
- [intake 规范](/Users/lijianfeng/code/pp/harness/harness/2026-04-01-harness-intake-interaction-spec-v0.1.md) 回答"harness 如何收敛任务"
- [agent-native 规范](/Users/lijianfeng/code/pp/harness/harness/2026-04-01-harness-agent-native-integration-spec-v0.1.md) 回答"harness 如何原生内置到 agent"
- 本文回答"agent-native 规范能不能落地，差什么"
