# Harness 设计文档 v0.1

> Status: Historical / Superseded
>
> 这份文档代表 `agent-harness` 的第一轮问题定义与协议优先思路，保留用于追溯设计起点。
> 当前主设计基线已切换到：
> [Agent Harness 设计文档 v0.3](docs/2026-04-03-agent-harness-design-v0.3.md)

## 1. 设计结论

我们要做的不是新的 agent 平台，而是一个项目通用、配置驱动、协议优先的轻量 harness。

它的定位是：

- 统一 agent 任务收敛协议
- 复用现有 skills
- 让不同项目通过少量配置接入
- 优先解决任务定义不清、边界失控、执行跑偏

它不是：

- 新的 LLM runtime
- 新的 tool protocol
- 新的 IDE
- 全自动交付系统

一句话定义：

`Harness = 任务协议 + 阶段流转 + 项目配置 + skill 适配层`

## 2. 背景问题

当前 agent 编程最大的问题不是“不会写”，而是“不会稳定收敛”：

- 任务输入格式随人变化，目标不稳定
- 不同项目缺少统一边界声明
- skills 有方法论，但没有统一接入协议
- agent 输出常常是自然语言，不是结构化任务状态
- 同一个任务在不同仓库、不同 agent 上不可复用

所以第一版要优先解决：

- 任务收敛
- 项目接入一致性
- skills 资产复用
- 状态与结果结构化

## 3. 目标与非目标

### 3.1 目标

第一版目标：

- 多语言通用，但只覆盖最小公共能力
- 统一任务输入、阶段流转、结果输出
- 允许 skill 和非-skill workflow 共存
- 项目通过配置接入，而不是改核心代码
- 给后续验证、安全、恢复预留扩展点

### 3.2 非目标

第一版不做：

- 深度语言特化能力
- 完整 runtime 调度系统
- 分布式多 agent orchestration
- 复杂权限执行器
- 自动生成所有验证脚本

原因：这些都不是当前最短路径。

## 4. 设计原则

1. `Protocol First`
   先定义协议，再谈执行器和实现细节。
2. `Project-Light`
   项目接入成本必须低，最好是“加几个文件 + 少量配置”。
3. `Skills Native, Not Skills Bound`
   skills 是一等能力，但不是底层耦合点。
4. `Convergence Before Automation`
   先让任务少跑偏，再谈更强自动化。
5. `Evidence-Ready`
   第一版不以验证为核心，但所有对象都要为证据挂载留接口。
6. `Human Override`
   harness 是约束层，不是替代人的最终判断。

## 5. 总体架构

三层结构：

### 5.1 Harness Core

负责通用协议：

- 任务模型
- 阶段模型
- 状态模型
- 收敛判定
- 配置加载

### 5.2 Skill Adapters

负责把现有 skills 接入协议：

- skill 元数据
- 适用条件
- 输入输出约定
- 前后置要求
- 与阶段的映射关系

### 5.3 Project Config

负责每个项目的个性化声明：

- 工作模式
- 风险边界
- 目录作用域
- 默认验证入口
- 任务模板
- skill override
- 审批规则

这三层的关系是：

- Core 定义规则
- Adapter 接能力
- Project 说差异

## 6. 核心对象模型

### 6.1 Task Contract

任务必须结构化，不允许只靠自然语言漂移。

这里要明确区分“必须输入什么”和“系统可补全什么”，否则协议会迅速变重。

#### 6.1.1 必填字段

第一版只强制 4 个业务字段：

- `intent`
- `goal`
- `scope`
- `acceptance`

补充说明：

- `intent`：修 bug / 加功能 / 调研 / 重构 / 原型
- `goal`：这次要达成的直接目标
- `scope`：允许修改的模块、文件域、系统边界
- `acceptance`：什么算完成

缺任一项，就不能进入 `planned`，而应转入 `needs_clarification`。

#### 6.1.2 可选字段

第一版允许补充但不强制：

- `title`
- `constraints`
- `verification`
- `context_refs`

这些字段的作用是降低执行歧义，而不是提高填表负担。

#### 6.1.3 派生字段

以下字段默认不要求用户显式提供，可由项目配置、模板或 intake 阶段推导：

- `id`
- `mode`
- `risk_level`
- `evidence_required`

推导原则：

- `id`：由 harness 生成
- `mode`：默认取项目配置，可被任务显式覆盖
- `risk_level`：由 `scope` + `risk_rules` 推导，必要时人工确认
- `evidence_required`：由 `risk_level` 和 `verification` 推导

#### 6.1.4 最小合同示例

```yaml
intent: bug
goal: 修复登录页提交后卡死的问题
scope:
  - src/web/login/*
acceptance:
  - 用户提交后能正常跳转
  - 不修改现有接口契约
constraints:
  - 不改数据库 schema
```

### 6.2 Phase Model

统一任务阶段，第一版建议固定为：

1. `intake`
   读取任务，补全合同。
2. `clarify`
   识别缺失前提、边界和风险。
3. `plan`
   选择路径、映射 skill 或非-skill 流程。
4. `execute`
   执行最小必要动作。
5. `verify`
   记录验证证据。
6. `report`
   输出结构化结论。
7. `close`
   完成或挂起。

注意：

- 第一版中心是 `clarify + plan`
- `execute` 和 `verify` 先做成弱绑定接口，不做复杂编排

#### 6.2.1 Phase 与 State 的迁移规则

第一版不追求复杂状态机，但必须明确最小迁移条件：

1. `draft -> needs_clarification`
   必填字段缺失，或 `scope` / `acceptance` 无法执行判断。
2. `draft -> planned`
   必填字段完整，且已有可执行路径。
3. `planned -> in_progress`
   已确定本轮执行边界，并开始执行命令、修改或调研动作。
4. `in_progress -> blocked`
   存在当前无法自行解决的外部依赖、权限、环境或关键信息缺口。
5. `in_progress -> verifying`
   执行动作结束，开始收集验证证据。
6. `verifying -> done`
   必需验证通过，且必需证据已挂载。
7. `verifying -> failed`
   必需验证失败，且当前无可接受回退路径。
8. `any -> suspended`
   任务被主动暂停，但不是因外部阻塞。

判定约束：

- `blocked` 表示“想继续但继续不了”
- `suspended` 表示“暂时不继续，但不是被卡住”
- `failed` 表示当前路径失败，不等于永久不可恢复
- `done` 必须附带结论与证据摘要，不能只写“已完成”

### 6.3 State Model

任务状态不能只是“进行中/完成”。

建议最小状态：

- `draft`
- `needs_clarification`
- `planned`
- `in_progress`
- `blocked`
- `verifying`
- `done`
- `failed`
- `suspended`

还要有状态附带信息：

- 当前阶段
- 当前假设
- 已确认边界
- 已用 skill
- 未解决问题
- 下一步动作

第一版要求这些附带信息可结构化落盘，至少要能稳定序列化为 JSON/YAML，而不是只保留自然语言总结。

### 6.4 Evidence Model

第一版不强依赖，但必须标准化证据接口。

证据类型建议：

- `command_result`
- `test_result`
- `diff_summary`
- `artifact`
- `reasoning_note`
- `manual_confirmation`

这样第二版接验证闭环时不会重做对象设计。

## 7. Skill Adapter 设计

skills 不直接成为核心调度单位，而是通过 adapter 暴露能力。

每个 skill adapter 至少声明：

- `skill_name`
- `supported_intents`
- `supported_modes`
- `preferred_phases`
- `priority`
- `exclusive`
- `requires_inputs`
- `produces_outputs`
- `risk_notes`
- `verification_expectation`

第一版增加两个控制字段，避免选择规则悬空：

- `priority`：同类 adapter 的默认选择优先级
- `exclusive`：当前阶段是否独占，默认 `true`

示例映射：

- `brainstorming` 主要绑定 `clarify` 和 `plan`
- `safe-editing` 主要绑定 `execute`
- `validation-required` 主要绑定 `verify`
- `systematic-debugging` 绑定 `clarify`、`plan`、`execute`

这样做的好处：

- skill 可替换
- 同一任务可不用 skill 也能跑
- skill 可以按协议被调度，而不是写死流程

#### 7.1 Adapter 选择规则

第一版统一按下面 4 步选择：

1. `match`
   按 `intent`、`mode`、`phase` 过滤不适配的 adapter。
2. `validate`
   检查 `requires_inputs` 是否满足，不满足直接淘汰。
3. `score`
   按 `preferred_phases`、`priority`、`risk_notes`、项目 `skill_policy` 综合评分。
4. `select`
   每个阶段只产出一个执行策略。

执行策略不一定是 skill，也可以是 `no-skill workflow`。

#### 7.2 冲突解决规则

第一版固定以下优先级：

`task explicit override > project skill_policy > adapter priority > core fallback`

补充约束：

- 默认一个阶段只选一个 `exclusive=true` 的 adapter
- 若多个 adapter 同分，优先选择项目明确偏好的 adapter
- 若仍然冲突，回退到更低耦合的策略；必要时允许 `no-skill workflow`
- 第一版不做复杂多 adapter 编排，避免调度语义提前失控

## 8. Project Config 设计

每个项目只需要声明“自己的差异”，不重复通用协议。

第一版要避免配置地狱，所以区分“必需配置”和“可选配置”。

#### 8.1 必需配置

- `project_type`
- `default_mode`
- `allowed_paths`
- `protected_paths`
- `default_commands`
- `risk_rules`

#### 8.2 可选配置

- `languages`
- `task_templates`
- `skill_policy`
- `output_policy`

例如：

- 哪些目录默认可改
- 哪些模块属于高风险
- bug/feature/refactor 默认用什么模板
- 哪些 skill 强制启用，哪些可选
- 哪些任务必须带验证命令

这部分应该尽量配置化，而不是写脚本。

#### 8.3 配置优先级与冲突规则

第一版统一使用以下覆盖顺序：

`task contract explicit value > project config > core default`

关键规则：

- `protected_paths` 优先级高于 `allowed_paths`
- `task_templates` 只能补默认值，不能覆盖任务显式声明
- `skill_policy` 只表达 `force / prefer / deny`，不承担复杂编排职责
- `risk_rules` 决定 `risk_level` 的默认推导，不直接替代人工判断

## 9. 仓库约定

第一版建议约定以下文件：

- `AGENTS.md`
- `harness.yaml`
- `harness/tasks/*.md`
- `harness/skills/*.yaml`
- `harness/reports/`
- `docs/superpowers/specs/`

其中：

`AGENTS.md`

- 偏人类可读的行为和协作约束

`harness.yaml`

- 偏机器和协议可读的项目配置

两者不要混成一个文件。

## 10. 典型工作流

以一个 bugfix 为例：

1. 用户输入需求
2. harness 把自然语言映射成 `Task Contract`
3. 检查缺失项，进入 `clarify`
4. 根据 `intent`、`mode`、`risk`、`scope` 选择阶段策略
5. 从 adapter 中选择合适 skills
6. 生成本轮执行边界
7. 执行后记录状态和证据
8. 输出结构化结果

其中第 2 步和第 4 步必须遵守：

- 合同缺失必填字段时，不得直接进入执行
- 每个阶段最多选择一个主执行策略
- 项目配置只能补默认，不能篡改任务显式边界

输出至少包括：

- 任务结论
- 根因判断
- 实际改动范围
- 验证证据
- 剩余风险
- 下一步建议

## 11. 与现有 GEMINI/AGENTS 思想的关系

`GEMINI.md` 可以直接映射到这个设计里：

- `工作模式` -> `Task.mode`
- `SOP` -> `Phase Model`
- `高风险写入需确认` -> `risk_rules`
- `专业反驳权` -> `clarify` 阶段的必选行为
- `强制验证` -> `verification_expectation`

也就是说：

- `GEMINI/AGENTS` 提供行为哲学
- `Harness` 提供结构化执行协议

两者不是替代关系，而是上下层关系。

## 12. MVP 范围

第一版只做这些：

- 统一 Task Contract
- 统一 Phase Model
- 统一 State Model
- 明确 State Transition Rule
- 项目配置文件
- skill adapter 定义格式
- 至少 3 类任务模板：
  - bug
  - feature
  - explore

第一版不做：

- 自动路由到具体平台
- 复杂持久化引擎
- 图形界面
- 多 agent 编排
- 高级策略学习

## 13. 路线图

### Phase 1: Protocol MVP

产出：

- 协议定义
- 配置文件格式
- 仓库约定
- skill adapter 规范

### Phase 2: Local Runner

产出：

- 一个轻量 CLI
- 能读取任务和项目配置
- 输出结构化报告

### Phase 3: Validation Hooks

产出：

- 验证证据采集
- 命令执行记录
- 验证结果汇总

### Phase 4: Platform Adapters

产出：

- 对接 Codex / Claude Code / OpenHands / 自定义 agent

## 14. 关键权衡

1. 为什么不先做 runtime
   因为核心问题是任务收敛，不是工具调用缺失。
2. 为什么不让 skills 成为核心
   因为那会损失通用性，长期会被当前体系锁死。
3. 为什么先多语言通用，但只做最小公共能力
   因为如果一开始兼顾语言深度，MVP 很快失控。
4. 为什么把配置和行为文档分开
   因为一个给机器读，一个给人读，混在一起会同时变差。

## 15. 风险

1. `协议过大`
   如果第一版字段过多，项目接入会很重。
2. `skill adapter 设计过深`
   如果把每个 skill 的执行细节都纳入协议，会让 adapter 失控。
3. `项目配置过细`
   会导致每接一个项目都像重新造轮子。
4. `没有真实任务回压`
   如果不拿真实任务验证，这套设计很容易空转。
5. `状态规则不闭合`
   如果 phase 和 state 没有明确迁移条件，runner 和报告都会失真。

所以第一版必须坚持：

- 只服务真实任务
- 只保留最小协议
- 先在少量项目里迭代
- 先把“规则闭合”做完，再扩展实现层

## 16. 推荐命名

先给一个工程上中性的名字：

- `Harness Protocol`
- `Project Agent Harness`
- `ConvergeKit`

如果偏工程味，建议先用 `Harness Protocol` 作为内部名，简单直接。

## 17. 最终判断

这套设计最核心的点只有两个：

- 用协议统一任务收敛
- 用 adapter 吸纳 skills，而不是让 skills 绑架框架

只要这两点守住，后面无论接 CLI、MCP、IDE，还是别的 agent 平台，都还有演进空间。
