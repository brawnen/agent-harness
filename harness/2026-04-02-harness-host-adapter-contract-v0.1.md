# Harness Host Adapter Contract v0.1

## 1. 设计结论

Host Adapter Contract 是 Harness Core 与具体 agent 宿主之间的最小接口约定。

它解决的问题是：

- Harness Core 不关心你跑在哪个平台上
- 每个宿主的事件模型、hook 机制、状态存储、工具拦截能力各不相同
- 需要一份统一契约，让 Harness Core 知道"当前宿主能做什么"，并据此自动选择最强可用的门禁路径

一句话定义：

`Host Adapter Contract = 宿主能力声明 + 生命周期映射 + 门禁执行接口`

## 2. 三个宿主的现实映射

本文覆盖第一批三个宿主：

| 宿主 | 接入方式 | 能力上限 |
|---|---|---|
| Claude Code | CLAUDE.md + PreToolUse/PostToolUse hooks | L1（工具级）+ L2 |
| Codex | AGENTS.md 指令注入 | L2 |
| Gemini CLI | 系统指令注入 | L2 |

## 3. Host Adapter 接口定义

所有宿主 adapter 必须实现以下接口。接口用伪代码描述，不绑定具体语言。

```
interface HostAdapter {

  // ── 生命周期 ──────────────────────────────

  // 用户输入到达时触发，返回 intake 结果和控制信号
  on_user_input(input: string, context: TaskContext) -> IntakeResult

  // 工具调用前触发，返回是否允许执行
  before_tool_call(tool: string, args: object, context: TaskContext) -> GateResult

  // 工具调用后触发，更新状态和证据
  after_tool_call(tool: string, result: object, context: TaskContext) -> void

  // agent 准备宣称完成前触发，返回是否允许完成
  before_completion(task_id: string) -> CompletionResult

  // ── 状态管理 ──────────────────────────────

  get_state(task_id: string) -> HarnessState | null
  set_state(task_id: string, state: HarnessState) -> void
  persist_state(task_id: string) -> void
  restore_state(task_id: string) -> HarnessState | null

  // ── 能力声明 ──────────────────────────────

  // 宿主必须如实声明自己的能力，Harness Core 据此选择门禁路径
  capabilities() -> AdapterCapabilities
}
```

### 3.1 核心数据结构

```
struct IntakeResult {
  task_draft: TaskDraft
  signal: ControlSignal          // ask_one_question / proceed_to_plan / block_plan
  interaction: InteractionBlock  // 对外输出的自然语言块
}

struct GateResult {
  allowed: bool
  signal: ControlSignal          // proceed_to_execute / block_execution / require_confirmation
  reason: string | null          // blocked 时说明原因
}

struct CompletionResult {
  allowed: bool
  signal: ControlSignal          // allow_completion / block_completion / require_verification
  missing_evidence: string[]     // block 时说明缺少哪类 evidence
}

struct AdapterCapabilities {
  can_intercept_tool_call: bool       // 支持 before_tool_call（L1 工具级门禁）
  can_intercept_response: bool        // 支持 before_agent_reply（当前均为 false）
  can_persist_state: bool             // 支持状态落盘
  can_run_external_process: bool      // 支持调用外部 harness 进程
  gate_level: "L1" | "L2" | "L3"     // 当前能达到的最高门禁级别
  hook_mechanism: string              // 宿主的具体 hook 实现方式描述
}

struct TaskContext {
  task_id: string | null
  current_state: HarnessState | null
  project_config: HarnessConfig
}
```

### 3.2 不变量

所有 adapter 实现都必须遵守：

- `before_tool_call` 返回 `allowed: false` 时，工具调用必须被阻止，不得继续执行
- `capabilities()` 必须如实反映宿主能力，不得虚报（虚报会导致 Harness Core 选错门禁路径）
- `persist_state` 在 `before_tool_call` 返回 `allowed: true` 之后、工具实际执行之前调用
- `after_tool_call` 无论工具成功或失败都必须被调用
- adapter 不得修改 `HarnessState` 中的业务字段（task_draft、confirmed_contract），只允许更新 phase、state、evidence、updated_at

## 4. Claude Code Adapter

### 4.1 能力声明

```json
{
  "can_intercept_tool_call": true,
  "can_intercept_response": false,
  "can_persist_state": true,
  "can_run_external_process": true,
  "gate_level": "L1",
  "hook_mechanism": "PreToolUse / PostToolUse hooks via .claude/settings.json"
}
```

### 4.2 生命周期映射

| Harness Hook | Claude Code 映射方式 |
|---|---|
| `on_user_input` | CLAUDE.md 指令约束 agent 在每次新输入时执行 intake（L2） |
| `before_tool_call` | `.claude/settings.json` 的 `PreToolUse` hook，调用外部 harness CLI |
| `after_tool_call` | `.claude/settings.json` 的 `PostToolUse` hook，调用外部 harness CLI |
| `before_completion` | CLAUDE.md 指令约束 agent 在宣称完成前执行验证检查（L2） |
| `before_agent_reply` | 不可达，future_placeholder |

### 4.3 接入方式

**Step 1：CLAUDE.md 注入 harness 行为规则（L2 门禁）**

在项目的 `CLAUDE.md` 中添加以下规则块：

```markdown
## Harness 任务收敛规则

### Intake 规则
每次收到新任务时，必须先内部推断以下字段，再决定下一步：
- intent：bug / feature / explore / refactor / prototype
- goal：一句话描述要达成的结果
- scope：允许修改或分析的边界
- acceptance：什么算完成

所有字段均可从自然语言推断，不要求用户填写。

### Clarify 规则
只在以下情况追问用户：
- scope 可能越过 protected_paths
- acceptance 无法判断完成
- 风险等级被推断为 high
每次只问一个最高价值问题。

### 执行门禁（L2）
以下情况禁止直接执行工具或修改文件：
- intent / goal / scope / acceptance 尚未全部确定
- 当前任务处于 needs_clarification 状态
- 执行动作明显超出已确认的 scope

### 完成门禁（L2）
以下情况禁止宣称任务完成：
- bug / feature / refactor 任务：未运行验证命令或测试
- explore 任务：未给出结论、依据和下一步建议
- 仍有未关闭的阻断问题

### 交互输出格式
每轮任务相关输出至少包含：
- 我的理解：当前对任务的收敛理解
- 当前假设：已采用但未确认的假设
- 阻断缺口：若存在，只问一个；若无，写"无"
- 下一步动作：clarify / plan / execute / verify
```

**Step 2：.claude/settings.json 配置 hooks（L1 工具级门禁）**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "harness gate before-tool --tool $TOOL_NAME --task-state harness/state/tasks/$(cat harness/state/index.json | jq -r '.active_task_id').json"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "harness state update --tool $TOOL_NAME --exit-code $EXIT_CODE --task-id $(cat harness/state/index.json | jq -r '.active_task_id')"
          }
        ]
      }
    ]
  }
}
```

**harness CLI 的 `gate before-tool` 命令**：

- 读取当前任务状态文件
- 执行确定性信号判断（字段完整性、risk_rules、scope 匹配）
- 退出码 0：允许执行（`proceed_to_execute`）
- 退出码 1：阻止执行（`block_execution`），输出阻断原因
- 退出码 2：需要确认（`require_confirmation`），输出风险说明

注意：`PreToolUse` hook 退出码非 0 时，Claude Code 会阻止工具调用。这是当前唯一可用的 L1 路径。

### 4.4 降级路径

| 场景 | 降级行为 |
|---|---|
| harness CLI 未安装或启动失败 | hook 返回 0（允许执行），写入 audit_log（gate_violation），降级到 L2 |
| 外部进程响应超时（>2s） | 同上，不因 harness 自身问题阻断正常工作 |
| state 文件不存在 | 允许执行，但触发 `on_user_input` 重新 intake |

### 4.5 当前无法实现的项

- `before_agent_reply`：Claude Code 没有 response-level hook，无法在回复生成前拦截
- 语义级 `before_plan` 硬门禁：`before_plan` 不对应任何 Claude Code 原生事件，只能通过 CLAUDE.md 指令做 L2 约束

---

## 5. Codex Adapter

### 5.1 能力声明

```json
{
  "can_intercept_tool_call": false,
  "can_intercept_response": false,
  "can_persist_state": true,
  "can_run_external_process": true,
  "gate_level": "L2",
  "hook_mechanism": "AGENTS.md 指令注入，无原生 hook 机制"
}
```

### 5.2 生命周期映射

| Harness Hook | Codex 映射方式 |
|---|---|
| `on_user_input` | AGENTS.md 指令约束（L2） |
| `before_tool_call` | 不可达，降级到 L2（AGENTS.md 指令） |
| `after_tool_call` | 不可达，降级到 L3（任务完成后手动调用 harness CLI） |
| `before_completion` | AGENTS.md 指令约束（L2） |
| `before_agent_reply` | 不可达 |

### 5.3 接入方式

**Step 1：AGENTS.md 注入 harness 行为规则**

内容与 CLAUDE.md 模板相同（见 §4.3），语法与格式保持一致。

**Step 2：任务结束后手动调用 harness CLI（L3 审计）**

```bash
# 任务完成后，手动触发 harness 验证和报告生成
harness task verify --task-id <task_id>
harness task report --task-id <task_id>
```

**Step 3：Codex 任务启动时恢复 state（可选）**

```bash
# 在 AGENTS.md 的初始化说明中加入
harness state restore --task-id <task_id>
```

### 5.4 降级路径

Codex Adapter 整体运行在 L2，所有门禁都是"高概率约束"而非硬拦截。

已知风险：

- Codex 在长上下文中可能遗忘 AGENTS.md 中的规则
- 没有工具级 hook，无法阻止 Codex 越界执行

缓解措施：

- 在 AGENTS.md 中将关键门禁规则置于文件顶部
- 每次任务启动时，通过 harness CLI 检查 state 并输出当前门禁状态摘要
- 使用 L3 审计事后检测违规

### 5.5 当前无法实现的项

- 所有 L1 门禁：Codex 无原生 hook 机制
- `before_agent_reply`：不可达

---

## 6. Gemini CLI Adapter

### 6.1 能力声明

```json
{
  "can_intercept_tool_call": false,
  "can_intercept_response": false,
  "can_persist_state": true,
  "can_run_external_process": true,
  "gate_level": "L2",
  "hook_mechanism": "GEMINI.md 系统指令注入，无原生 hook 机制"
}
```

### 6.2 生命周期映射

与 Codex Adapter 基本相同，指令注入文件为 `GEMINI.md`。

| Harness Hook | Gemini CLI 映射方式 |
|---|---|
| `on_user_input` | GEMINI.md 指令约束（L2） |
| `before_tool_call` | 不可达，降级到 L2 |
| `after_tool_call` | 不可达，降级到 L3 |
| `before_completion` | GEMINI.md 指令约束（L2） |
| `before_agent_reply` | 不可达 |

### 6.3 接入方式

**Step 1：GEMINI.md 注入 harness 行为规则**

内容与 CLAUDE.md / AGENTS.md 模板相同。

**Step 2：与 Codex 相同的 L3 审计路径**

```bash
harness task verify --task-id <task_id>
harness task report --task-id <task_id>
```

### 6.4 降级路径与注意事项

与 Codex Adapter 相同（见 §5.4）。

---

## 7. 跨宿主一致性要求

无论使用哪个宿主 adapter，以下行为必须保持一致：

| 行为 | 一致性要求 |
|---|---|
| intake 推断逻辑 | 相同，不因宿主而变 |
| 控制信号语义 | 相同，不因宿主而变 |
| 验证矩阵（§16） | 相同，不因宿主而变 |
| state 文件格式 | 相同 schema，不因宿主而变 |
| report 格式 | 相同 schema，不因宿主而变 |
| audit_log 格式 | 相同 schema，不因宿主而变 |
| force_override 记录 | 相同逻辑，不因宿主而变 |

允许因宿主不同而变的：

- 门禁级别（L1 / L2 / L3）
- hook 触发方式
- 指令注入文件（CLAUDE.md / AGENTS.md / GEMINI.md）
- 外部进程调用方式

## 8. 三宿主能力对比

| 能力 | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| 指令注入 | ✓ CLAUDE.md | ✓ AGENTS.md | ✓ GEMINI.md |
| 工具级拦截（L1） | ✓ PreToolUse hook | ✗ | ✗ |
| 工具后记录（L3） | ✓ PostToolUse hook | ✗ 需手动 | ✗ 需手动 |
| 状态持久化 | ✓ | ✓（文件读写） | ✓（文件读写） |
| 外部进程调用 | ✓ | ✓ | ✓ |
| 回复级拦截 | ✗ | ✗ | ✗ |
| 最高门禁级别 | L1 + L2 | L2 | L2 |

## 9. 门禁降级决策树

Harness Core 在调用 `capabilities()` 后，按以下逻辑选择执行路径：

```
if can_intercept_tool_call == true:
    before_tool_call -> 调用外部 harness CLI -> 确定性 L1 判断
    after_tool_call  -> 调用外部 harness CLI -> L1 状态更新
else:
    before_tool_call -> AGENTS.md / GEMINI.md 指令约束 -> L2
    after_tool_call  -> 不触发，依赖 before_completion L2 兜底

if can_intercept_response == true:   # 当前无宿主支持
    before_agent_reply -> L1 回复级拦截
else:
    skip（future_placeholder）

before_completion:
    if can_run_external_process == true:
        调用 harness CLI 做确定性 evidence 检查（L1）
    else:
        agent 自行判断（L2）
```

## 10. Phase 1 的 Adapter 实现优先级

Phase 1（Prompt-Native Harness）阶段，三个 adapter 的实现优先级：

1. **Claude Code Adapter（优先）**
   - 能力最强，可验证 L1 + L2 混合路径
   - hook 机制成熟，可立即接入
   - 最适合作为参考实现

2. **Codex Adapter（次优先）**
   - 作为 L2 only 的对比验证
   - 验证纯 prompt 约束的有效性上限

3. **Gemini CLI Adapter（可推迟）**
   - 与 Codex Adapter 能力基本相同
   - Phase 1 可先复用 Codex 的 AGENTS.md 模板验证

## 11. 与 v0.2 设计文档的关系

本文是对 v0.2 主设计文档 §17（Host Adapter 最小接口契约）的展开实现说明：

- v0.2 §17 定义接口签名和 capabilities 结构
- 本文定义三个具体宿主的映射方式、接入步骤、降级路径和能力对比

本文不修改 Harness Core 的任何协议定义。如果某宿主的限制导致需要修改核心协议，应先在 v0.2 中讨论，而不是在 adapter 层绕过。

## 12. 已知限制与后续演进

### 12.1 当前已知限制

1. **所有宿主的 `before_plan` 都是 L2**
   plan 阶段没有对应的 tool-level hook，只能通过指令约束。

2. **`before_completion` 在 Codex / Gemini 下是 L2**
   只有 Claude Code 可以通过外部进程调用做 evidence 确定性检查。

3. **多会话 state 同步**
   当前 state 以本地文件为中心，跨设备或多人协作场景下 state 可能不同步。

4. **harness CLI 是隐含依赖**
   L1 路径依赖外部 harness CLI 可执行文件。Phase 1 可以先不实现 CLI，只用 L2，但 Phase 2 必须提供。

### 12.2 后续演进方向

- 当 Claude Code 开放 `before_response` hook 或语义级中间件时，升级 `before_agent_reply` 从 future_placeholder 到 L1
- 当 Codex / Gemini CLI 开放 hook 机制时，对应 adapter 升级到 L1
- 引入 harness server 模式（本地 daemon），替代当前每次 fork 外部进程的方式，降低延迟
