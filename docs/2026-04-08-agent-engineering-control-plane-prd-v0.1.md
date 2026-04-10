# Agent Engineering Control Plane PRD v0.1

> 日期：2026-04-08
> 状态：草案
> 目标读者：产品负责人 / 技术负责人 / 平台负责人

---

## 1. 产品概述

### 1.1 产品名称

`Agent Engineering Control Plane`

### 1.2 一句话定义

面向团队和企业，统一管理 Codex、Claude Code、Gemini CLI 等 agent 的任务协议、风险规则、证据链、交付流程与审计能力。

### 1.3 产品结论

本产品不再定位为“给单个宿主补一层本地 harness”，而定位为：

- 跨 agent 的工程治理与交付控制平面
- 团队级的 agent 使用规范与审计系统
- 宿主无关的协议、策略和证据资产层

---

## 2. 背景与问题

### 2.1 当前问题

AI coding agent 在 demo 或个人场景里表现很好，但进入真实团队和真实仓库后，会出现以下问题：

- 不同宿主行为不一致，团队无法统一工作方式
- agent 的任务边界、风险边界和交付标准依赖个人习惯
- 高风险操作是否确认、谁确认过、为什么放行，缺少统一审计
- agent 口头说“完成”，但缺少结构化证据和交付工件
- 复杂领域任务无法只靠通用 agent 自由发挥

### 2.2 当前方案的问题

如果产品继续围绕 repo-local harness patch 演进，虽然短期可用，但长期会被宿主原生能力吸收，包括：

- 任务续接与上下文恢复
- 高风险确认
- 工具门禁
- 默认输出优化
- 单任务 plan / execute / verify 闭环

因此，继续强化“本地 wrapper 能力”不构成长期产品价值。

### 2.3 机会点

宿主原生会越来越强，但它们不太会优先替组织解决：

- 跨宿主统一协议
- 组织级 policy as code
- override 审计与审批
- 证据驱动交付
- 多仓、多团队、多 agent 的一致治理
- 领域 workflow 资产沉淀

这就是产品真正的切入点。

---

## 3. 目标用户

### 3.1 核心用户

1. 平台工程团队  
负责 agent 推广、统一规范、平台治理和基础设施建设。

2. 技术负责人 / 团队负责人  
需要知道 agent 在做什么、风险是否受控、结果是否可信。

3. 安全 / 合规负责人  
关注高风险操作、人工确认、override、证据链与审计。

### 3.2 次级用户

1. 已在真实仓库中使用多个 agent 的研发团队
2. 多仓、多模块维护者
3. 开源项目维护者

### 3.3 非优先用户

1. 只把 agent 当问答助手的人
2. 玩具项目 / 一次性 PoC 用户
3. 不关心验证和治理、只关心速度的场景

---

## 4. 目标与非目标

### 4.1 产品目标

本阶段 PRD 的目标是验证以下能力是否值得做成产品：

1. 让团队能够跨 Codex / Claude / Gemini 复用同一套任务与交付规则
2. 让 agent 的执行结果从“聊天记录”升级为“可审计工程记录”
3. 让高风险行为、人工确认、override 有结构化轨迹
4. 让复杂领域任务能被沉淀为可复用 workflow pack
5. 让平台团队能看见 agent 的质量、风险和价值分布

### 4.2 非目标

本阶段不追求：

1. 替代宿主原生交互体验
2. 做成更聪明的本地 wrapper
3. 直接解决所有 agent 推理质量问题
4. 做成通用项目管理工具
5. 一开始就覆盖所有领域 workflow

---

## 5. 核心价值主张

### 5.1 对团队的价值

- 同一套 protocol，可运行在多个 agent 宿主上
- 同一套交付标准，不依赖个人习惯
- 同一套风险治理和证据机制，可团队复用

### 5.2 对平台和管理者的价值

- 能定义哪些事情 agent 可以做，哪些必须确认
- 能查看 agent 的执行证据、风险动作和交付质量
- 能把 agent 使用从“个人习惯”变成“组织系统”

### 5.3 对未来的价值

- 不被某个宿主锁定
- 组织经验沉淀为 workflow / policy / eval 资产
- 形成长期壁垒，而不是依赖宿主缺失能力

---

## 6. 产品形态

### 6.1 Agent Runtime

形态：

- 开源 CLI / SDK / repo-local runtime
- 跟随宿主运行
- 本地执行 task / gate / verify / report 等协议能力

职责：

- 宿主适配
- 本地协议执行
- 基础 evidence 采集

### 6.2 Control Plane

形态：

- Web 控制台 + API
- 团队级 / 企业级服务

职责：

- 配置策略
- 查看任务状态和证据
- 审核 override
- 管理 workflow packs
- 评估 agent 使用质量

---

## 7. 典型使用场景

### 场景 A：团队混用多个 agent

问题：

- 不同宿主对任务、确认、完成的处理方式不同
- 团队流程很难统一

需求：

- 统一的 task contract
- 统一的 verify / report / delivery 标准
- 统一的 evidence / audit 模型

### 场景 B：高风险仓库引入 agent

问题：

- 团队担心 agent 越界修改
- 担心风险确认无记录
- 担心“完成”没有证据

需求：

- 风险门禁
- 人工确认
- override 审计
- evidence-backed completion

### 场景 C：平台团队要规模化推广 agent

问题：

- 多个团队、多个仓库、多个宿主共同使用 agent
- 需要统一治理和可见性

需求：

- repo / team / org 多层 policy
- 统一审计与报表
- 跨项目一致控制

### 场景 D：复杂领域任务不能只靠通用 agent

问题：

- DB、安全、发布、事故类任务要求严格流程

需求：

- workflow pack
- required evidence
- required artifact
- domain verification

---

## 8. 核心对象模型

本产品的核心不是聊天消息，而是结构化对象。

### 8.1 必备对象

- `Task`
- `TaskContract`
- `TaskRun`
- `Evidence`
- `GateDecision`
- `OverrideEvent`
- `VerificationResult`
- `DeliveryReport`
- `PolicyBundle`
- `WorkflowPack`

### 8.2 最关键的三个对象

1. `TaskContract`  
定义目标、范围、验收、约束、风险。

2. `Evidence`  
定义完成的证据，不允许只靠口头完成。

3. `OverrideEvent`  
定义高风险动作是否被确认、由谁确认、为什么放行。

---

## 9. MVP 范围

本 PRD 的 MVP 只验证“组织控制面”的基本成立性，不追求一开始就做成完整平台。

### 9.1 MVP 必须有

1. 多宿主统一接入
- Codex
- Claude Code
- Gemini CLI

2. 统一协议对象
- task
- evidence
- gate
- report
- override

3. 基础 policy center
- risk policy
- output policy
- delivery policy
- override policy

4. 基础 control plane 页面
- Task Run
- Evidence Timeline
- Policy Center
- Workflow Packs
- Insights Dashboard

5. 基础 workflow pack 能力
- 至少支持 pack 注册、配置、查看

### 9.2 MVP 不做

1. 不做复杂项目管理功能
2. 不做聊天式 UI
3. 不做过多宿主专属体验优化
4. 不做高级权限系统之外的大型企业平台功能
5. 不一开始覆盖所有领域 workflow

---

## 10. 页面设计

### 10.1 Task Run

目标：

- 让开发者和负责人查看单个任务的执行状态

展示内容：

- 当前目标
- 当前阶段
- 当前风险等级
- 当前阻断
- 最近 gate
- 最近 evidence
- 当前交付 readiness
- 当前宿主

关键动作：

- 查看任务 contract
- 查看报告
- 查看最近一次风险确认

### 10.2 Evidence Timeline

目标：

- 让平台、安全、reviewer 看完整证据链

展示内容：

- command_result
- test_result
- report artifact
- override event
- manual confirmation
- delivery report

关键动作：

- 过滤不同证据类型
- 按时间回放
- 查看某次 gate 为什么 block / allow

### 10.3 Policy Center

目标：

- 统一管理策略

展示内容：

- 当前生效的 risk policy
- output policy
- delivery policy
- workflow policy
- 生效层级：repo / team / org

关键动作：

- 查看生效顺序
- 解释本次任务为什么被某条规则命中

### 10.4 Workflow Packs

目标：

- 把组织经验沉淀成可复用资产

展示内容：

- workflow 列表
- 适用场景
- required evidence
- required artifact
- recommended verification

关键动作：

- 绑定 pack 到任务类型 / 仓库 / 团队
- 查看 pack 历史使用效果

### 10.5 Insights Dashboard

目标：

- 衡量 agent 使用质量和平台价值

展示内容：

- false clarify rate
- false new-task rate
- override 次数
- completion without evidence
- 宿主间一致性
- 不同仓库 / 团队的风险分布

---

## 11. 关键用户旅程

### 旅程 1：平台团队配置规则

1. 进入 Policy Center
2. 配置团队风险规则
3. 配置高风险目录与确认要求
4. 配置某类任务必须具备的 evidence 和 artifact
5. 发布策略

成功标准：

- 后续任务能够按该策略被解释与执行

### 旅程 2：开发者用 agent 执行任务

1. 开发者在 Codex / Claude / Gemini 中发起任务
2. Runtime 执行协议逻辑并上报 Evidence
3. 若命中高风险门禁，需要人工确认
4. verify / report / delivery 结果结构化展示在 Task Run

成功标准：

- 开发者无需手工整理流程状态
- 负责人可追踪执行过程

### 旅程 3：技术负责人复查任务

1. 打开 Task Run
2. 查看任务 contract、最近 evidence、风险事件
3. 查看是否有 override
4. 查看交付是否满足标准

成功标准：

- 不进入终端也能理解任务是否可信

### 旅程 4：安全团队复查高风险动作

1. 在 Evidence Timeline 或 Dashboard 中筛选高风险任务
2. 查看 gate 事件与 manual confirmation
3. 查看是谁确认了动作
4. 查看最终是否有足够 evidence

成功标准：

- 风险动作可审计、可解释、可回放

---

## 12. 成功指标

### 12.1 产品成立性指标

- 至少 1 个团队愿意把它当治理工具，而不仅是本地插件
- 至少 2 个宿主被同一团队并行接入
- 至少 1 类 workflow pack 被反复复用

### 12.2 行为指标

- false clarify rate 下降
- false new-task rate 下降
- 无证据完成率下降
- 高风险未确认放行率下降

### 12.3 业务指标

- 团队级 adoption 增长
- 多仓接入增长
- policy 使用率增长
- workflow pack 使用率增长

---

## 13. 商业化边界

### 13.1 开源部分

- Runtime Adapter
- Protocol Engine
- 本地 CLI
- 基础 state / audit / report
- 基础 workflow starter

### 13.2 商业版部分

- Web Control Plane
- 多团队 / 多仓治理
- Policy Registry
- Override 审计中心
- Workflow Pack 管理
- Eval / Insights 报表
- RBAC / 组织管理

---

## 14. 现有实现如何承接

当前仓库的价值不在于“它是不是最终产品”，而在于它已经是未来平台的 `agent-side runtime` 雏形。

可以保留并升级的部分：

- task contract
- verify / report / delivery
- gate / risk policy
- audit / override
- workflow policy

应降级为底座而非卖点的部分：

- prompt 分类细节
- 本地输出格式优化
- 宿主专用小技巧
- repo-local wrapper 体验

---

## 15. 推进建议

如果认可本 PRD，下一步建议进入 `Architecture Design v0.1`，明确：

- runtime adapter 层
- protocol engine 层
- policy engine 层
- evidence store / audit store
- control plane API
- workflow pack 模型

在这份架构文档确认前，不建议继续把主要精力投入在宿主 patch 型优化上。

