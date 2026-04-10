# Agent Engineering Control Plane 产品方案 v0.1

> 日期：2026-04-08
> 状态：提案
> 目标读者：产品负责人 / 技术负责人 / 项目维护者

---

## 1. 结论摘要

当前 `agent-harness` 如果继续定位成“给 Codex / Claude Code / Gemini CLI 补一层本地 harness”，长期价值有限，且很可能被宿主原生能力替代。

更合理的方向不是继续做“宿主补丁型产品”，而是上移为：

- **跨 agent 的工程治理与交付控制平面**
- **面向团队和企业的 Agent Engineering Control Plane**

它的核心价值不在于让单个 agent 更聪明，而在于：

- 让多个 agent 在组织里按统一协议工作
- 让高风险行为和交付结果可审计、可验证、可复用
- 让团队不被某个宿主或模型绑定

一句话定义：

> 不是让 agent 更像工程师，而是让很多 agent 像可治理的工程系统一样工作。

---

## 2. 为什么当前产品定位不够强

### 2.1 当前定位

当前仓库的主要心智模型仍然是：

- 给宿主增加 intake / clarify / verify / report
- 给 agent 增加任务状态、风险门禁、交付收口
- 让本地仓库里的 agent 更“可控”

这套能力在今天有现实价值，但它本质上仍是：

- 宿主缺失能力的补丁
- 单 agent 执行行为的约束层
- repo-local 的 runtime 强化

### 2.2 核心风险

这类价值会被未来的宿主原生能力快速吞噬，尤其是：

- 任务续接与上下文恢复
- 高风险确认
- 工具门禁
- 完成前验证提醒
- 默认输出简化
- 单次任务 plan / execute / verify 闭环

如果产品继续围绕这些能力打磨，长期会出现两个问题：

1. 功能越来越像“更会问问题的本地 wrapper”
2. 差异化越来越依赖 prompt / hook 小技巧，而不是产品壁垒

因此，必须尽快把产品心智从“agent runtime patch”切到“组织控制面”。

---

## 3. 新的产品定位

### 3.1 产品名称建议

可沿用内部代号，但对外定位建议改成：

- `Agent Engineering Control Plane`
- `Model-agnostic Agent Delivery Control Plane`
- `Cross-Agent Governance & Delivery Platform`

### 3.2 一句话定位

> 面向团队和企业，统一管理 Codex、Claude Code、Gemini CLI 等 agent 的任务协议、风险规则、证据链、交付流程与审计能力。

### 3.3 核心主张

这个产品不应该再卖“更会补 harness”，而应该卖：

- **跨宿主一致性**
- **组织级治理**
- **证据驱动交付**
- **领域化 workflow**
- **agent 行为可评估**

### 3.4 不再强调的旧定位

以下叙事应降级为次要能力，不再作为核心卖点：

- 更自然的任务切换
- 更短的默认输出
- 更会提示用户确认
- 更懂当前 prompt 是新任务还是旧任务

这些能力仍有必要，但它们是底座，不是产品终局。

---

## 4. 产品价值

### 4.1 对团队的价值

对于真实使用 agent 的团队，问题从来不只是“模型会不会写代码”，而是：

- 当前任务到底是什么
- 什么情况下 agent 可以直接做
- 什么情况下必须拦住
- 做完后凭什么算完成
- 谁确认过高风险动作
- 哪些验证、文档、报告必须补齐

产品的价值就在于把这些问题从“靠个人经验解决”升级成“靠系统协议解决”。

### 4.2 长期壁垒

真正的长期壁垒不在于本地 CLI，而在于：

1. **跨 agent 的统一协议层**
2. **组织级 policy as code**
3. **evidence-backed delivery**
4. **override / audit 体系**
5. **领域 workflow pack**
6. **行为评估与回放数据**

这几项能力，不是宿主原生会优先替企业做完的部分。

---

## 5. 目标用户

### 5.1 一级目标用户

- 已经在工程仓库中使用 AI coding agent 的团队
- 平台团队、研发效能团队、安全团队
- 多仓、多宿主、多 agent 并存的组织

### 5.2 二级目标用户

- 技术负责人
- 开源项目维护者
- 希望统一 agent 流程的中大型团队

### 5.3 不优先的用户

- 只把 agent 当问答助手的用户
- 只做玩具项目 / PoC 的用户
- 不关心验证和治理的纯个人场景

---

## 6. 典型使用场景

### 场景 1：团队混用多个 agent

现状问题：

- 有人用 Codex，有人用 Claude，有人用 Gemini
- 宿主体验不同，执行习惯不同
- 团队无法统一交付标准

产品价值：

- 同一套 task contract
- 同一套 gate / verify / report
- 同一套 evidence / audit
- 可随时替换底层宿主而不损失流程资产

### 场景 2：高风险仓库引入 agent

现状问题：

- 团队担心 agent 越界写文件
- 担心高风险动作没人确认
- 担心完成是“口头完成”，没有证据链

产品价值：

- 风险门禁
- 人工确认机制
- override 审计
- evidence-backed completion

### 场景 3：平台团队要规模化推广 agent

现状问题：

- 不只是少数高手在用，而是很多开发都开始用
- 需要统一规范、权限边界和审计手段

产品价值：

- 团队级 / 仓库级 / 组织级 policy
- 可视化审计与报表
- 多项目统一治理

### 场景 4：复杂领域任务不适合通用 agent 自由发挥

典型领域：

- 数据库变更
- 安全修复
- 发布准备
- 生产事故处置
- 设计评审 / ADR / changelog 治理

产品价值：

- Workflow Pack
- Required Evidence
- Required Artifact
- Domain Verification

### 场景 5：管理层和平台团队要衡量 agent 效果

现状问题：

- 看得到对话，看不到质量
- 看得到代码，看不到风险
- 看得到结果，看不到过程

产品价值：

- false clarify rate
- false new-task rate
- override 频率
- evidence 覆盖率
- 不同宿主表现对比

---

## 7. 产品形态

建议做成两段式产品。

### 7.1 Agent Runtime

形态：

- 开源 CLI / SDK / repo-local runtime
- 跟宿主一起运行
- 提供 task / gate / verify / report 的协议执行能力

作用：

- 作为 adoption 入口
- 保持接入成本低
- 标准化各宿主行为

这个阶段的定位不是最终产品，而是：

- `runtime`
- `protocol executor`
- `agent-side adapter`

### 7.2 Control Plane

形态：

- Web 控制台 + API
- 团队级 / 企业级使用

作用：

- 统一配置 policy
- 查看任务 timeline
- 查看 verify / report / delivery 状态
- 审核 override
- 管理 workflow pack
- 查看 agent 行为质量与趋势

---

## 8. 核心产品能力设计

### 8.1 Protocol Layer

统一协议对象：

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

核心能力：

- intake / continue / suspend / switch
- verify / report / delivery readiness
- risk gate / completion gate
- evidence collection
- override audit
- workflow execution

### 8.2 Policy Layer

统一策略模型：

- `risk_policy`
- `output_policy`
- `delivery_policy`
- `override_policy`
- `workflow_policy`

要求：

- 可本地执行
- 可服务端执行
- 可解释为什么 block / allow
- 支持 repo / team / org 多层覆盖

### 8.3 Evidence Layer

Evidence 不是附属信息，而是产品内核之一。

支持的 evidence 类型至少包括：

- `command_result`
- `test_result`
- `reasoning_note`
- `report_artifact`
- `manual_confirmation`
- `force_override`

要求：

- 可以结构化存储
- 可以时间线回放
- 可以聚合分析

### 8.4 Workflow Pack Layer

这是未来 moat 的核心之一。

每个 workflow pack 至少定义：

- 适用任务类型
- 风险边界
- 必需 evidence
- 必需 artifact
- 推荐验证
- 常见失败模式

第一批优先包建议：

- DB Change Safety
- Secure Fix
- Release Readiness
- Production Incident
- Docs / ADR Governance

---

## 9. Control Plane 设计方案

不建议做成聊天记录查看器，应该做成工程控制台。

### 页面 1：Task Run

目标：

- 给开发者、reviewer、负责人看单任务执行情况

展示内容：

- 当前目标
- 当前阶段
- 当前宿主
- 风险等级
- 当前阻断
- 最近 gate
- 最近 evidence
- 当前是否可 delivery

### 页面 2：Evidence Timeline

目标：

- 给平台、安全、技术负责人看完整证据链

展示内容：

- 命令证据
- 测试证据
- 报告工件
- 谁确认过高风险动作
- 哪次 override 生效
- 哪次 gate 阻断或放行

### 页面 3：Policy Center

目标：

- 管理团队和仓库的规则

展示内容：

- 当前生效 policy
- 规则来源层级
- 为什么被 allow / block
- repo / team / org 的叠加关系

### 页面 4：Workflow Packs

目标：

- 让团队把流程沉淀成资产

展示内容：

- 可复用 workflow 列表
- 适用场景
- 必需 evidence
- 必需 artifact
- 参考验证方式

### 页面 5：Insights / Eval Dashboard

目标：

- 让平台和产品团队能衡量 agent 质量

展示内容：

- false clarify rate
- false new-task rate
- false confirmation rate
- completion without evidence
- 宿主间一致性
- 按团队 / 仓库 / 任务类型的分布

---

## 10. 商业化边界建议

### 10.1 开源部分

建议保留开源的能力：

- Runtime Adapter
- Protocol Engine
- 本地 state / audit / report
- 基础 policy executor
- 基础 workflow starter
- 本地 CLI

### 10.2 商业化部分

建议商业化承载在：

- Control Plane
- 团队级 policy registry
- 多仓可视化审计
- override review
- workflow pack 管理
- 评估与报表
- RBAC / 组织管理

### 10.3 商业价值逻辑

开源吸引开发者和仓库接入，商业化承接：

- 团队治理
- 安全与审计
- 组织资产沉淀
- 规模化使用场景

---

## 11. 对现有实现的重新定义

当前仓库不是没价值，而是角色需要重定义。

当前实现最合理的定位应该是：

- 未来产品的 `runtime + protocol engine` 雏形
- 不是最终产品本身

也就是说，现有仓库的职责应收敛为：

1. 宿主适配层
2. 协议执行层
3. 本地 evidence / state / report 基础层

而不是继续被当成完整产品终态。

### 11.1 继续保留的部分

- task contract
- gate
- verify / report / delivery
- audit / override
- output policy
- workflow policy

这些能力应该保留，但作为平台底座。

### 11.2 不再过度投入的部分

- 单宿主专用 prompt 技巧
- 本地输出格式微调
- 复杂的 prompt 分类兜底
- 继续把产品做成 repo-local wrapper

这些应降级为底层体验优化，不应再占据主产品心智。

---

## 12. 产品路线图

### Phase 1：2-4 周，收敛成 Protocol Runtime

目标：

- 当前仓库不再像一组 hook patch
- 模块边界收敛为 runtime / protocol / policy / evidence

关键工作：

- 拆分 runtime adapter 和 protocol logic
- 收敛 policy schema
- 完善 evidence 模型
- 对话判定逻辑回归到“底座能力”

成功标志：

- 单宿主 patch 色彩下降
- 多宿主行为模型统一

### Phase 2：4-8 周，建立 Governance Core

目标：

- 从本地工具走向团队治理内核

关键工作：

- policy as code
- override policy
- evidence schema
- storage abstraction
- audit event model

成功标志：

- 任务从输入到交付有完整证据链
- 多仓 / 多宿主复用同一治理模型

### Phase 3：8-12 周，做 Control Plane MVP

目标：

- 让组织层面可以真正使用

MVP 页面：

- Task Run
- Evidence Timeline
- Policy Center
- Workflow Packs
- Insights Dashboard

成功标志：

- 技术负责人不进入终端也能看清 agent 任务
- 安全 / 平台团队可审计高风险动作

### Phase 4：3-6 个月，做领域工作流与商业化

目标：

- 把平台价值做深，而不是继续做 wrapper

重点方向：

- Workflow Pack 市场化
- 团队策略中心
- 审计与评估报表
- 多组织管理

成功标志：

- 产品价值来自组织治理和资产，而不是本地 hook

---

## 13. 继续推进前的判断标准

在决定是否继续投入前，建议只问 3 个问题：

1. 如果 Codex / Claude / Gemini 明天都自带基础 harness，这个产品还有价值吗？
2. 如果去掉 repo-local wrapper 的体验优化，这个产品还有价值吗？
3. 如果一个 100 人的工程团队混用多个 agent，这个产品能解决他们真实的问题吗？

如果这三个问题都可以回答“有”，则值得继续推进。

如果答案仍然主要依赖：

- 更好的 hook
- 更好的 prompt 判定
- 更自然的本地交互

那就不值得继续做成独立产品。

---

## 14. 当前建议

当前建议不是继续直接堆功能，而是先确认这个方向是否成立。

如果认可本提案，下一步建议产出两份文档：

1. `PRD v0.1`
2. `Architecture Design v0.1`

其中：

- `PRD` 负责目标用户、价值主张、页面和商业边界
- `Architecture Design` 负责 runtime / protocol / policy / evidence / control plane 的技术分层

在这两份文档确认前，不建议继续把主要精力投入在宿主 patch 型优化上。

