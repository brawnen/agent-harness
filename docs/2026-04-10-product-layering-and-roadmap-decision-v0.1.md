# Agent Harness 产品分层与路线定版稿 v0.1

> 日期：2026-04-10
> 状态：已确认
> 目标读者：产品负责人 / 技术负责人 / 项目维护者
> 相关文档：
> - `2026-04-08-agent-engineering-control-plane-product-proposal-v0.1.md`
> - `2026-04-08-agent-engineering-control-plane-prd-v0.1.md`
> - `2026-04-10-cli-closure-agent-native-transition-plan-v0.1.md`

---

## 1. 结论

`agent-harness` 需要明确分成两个层次：

1. **近端产品：Agent Harness Runtime**
   - 面向已经在仓库里使用 agent 的团队
   - 负责 repo-local 协议执行、门禁、验证、报告、审计
   - 以 `protocol + repo-local hooks + compatibility CLI` 形态交付
   - 目标是收敛成一个可被小团队实际使用的开源 runtime 产品

2. **远端产品：Agent Engineering Control Plane**
   - 面向团队和企业
   - 负责跨宿主治理、策略中心、证据中心、workflow pack、质量洞察
   - 目标是未来真正的主产品方向

一句话总结：

> 现在的 `agent-harness` 不是未来主产品本身，而是未来控制面的 runtime 基座和 adoption 入口。

---

## 1.1 本轮已确认决议

本轮讨论已确认以下 4 项决议：

1. 当前阶段正式产品名采用 **Agent Harness Runtime**
2. 正式冻结 `CLI` 扩张，`CLI` 只保留 compatibility layer 职责
3. Runtime 收尾按“团队可试用”验收，而不是按“继续扩张功能”验收
4. 下一阶段主产品方向正式切到 **Agent Engineering Control Plane**

---

## 2. 三份文档的关系

这三份文档不是冲突关系，而是同一条产品转向链路上的三个层次。

### 2.1 `product proposal`

角色：

- 回答为什么要转向
- 主要是战略判断

核心结论：

- 继续深挖本地 harness / CLI 长期价值有限
- 长期价值应上移到组织级控制面

### 2.2 `prd`

角色：

- 回答转向后的目标产品长什么样
- 主要是目标态定义

核心结论：

- 未来主产品是 `Agent Engineering Control Plane`
- 用户、对象模型、MVP 范围、页面和能力边界开始清晰化

### 2.3 `cli closure / transition plan`

角色：

- 回答从今天走到目标态怎么过桥
- 主要是迁移和收尾方案

核心结论：

- `CLI` 不再作为主产品深挖
- 现有能力要收敛为 runtime + compatibility layer

### 2.4 三者的相同点

- 都认为“宿主补丁型本地 wrapper”不是长期主产品
- 都认为长期价值在跨宿主一致性、策略治理、证据链、审计和 workflow 资产
- 都默认未来产品中心不应是 `CLI`

### 2.5 三者的不同点

- `proposal` 偏战略判断
- `prd` 偏目标产品设计
- `transition plan` 偏现实落地路径

---

## 3. 统一后的产品定义

### 3.1 当前阶段产品定义

当前阶段不再把 `agent-harness` 定义成“持续扩张的 CLI 产品”，而定义成：

> 一个面向真实工程仓库的 agent runtime 产品。

它负责：

- 统一 task contract
- 统一 gate / verify / report
- 统一 evidence / override / audit
- 统一宿主接入的基础执行面

它不再负责：

- 继续围绕 CLI 扩子命令
- 追求越来越像宿主的交互体验
- 在 repo-local 形态里承载未来全部产品价值

### 3.2 未来阶段产品定义

未来真正的主产品定义为：

> 面向团队和企业的 Agent Engineering Control Plane。

它负责：

- 跨宿主统一治理
- policy center
- evidence center
- workflow packs
- override / 审批 / 审计
- 质量与价值洞察

---

## 4. 现有 `protocol + CLI` 应该如何收尾

收尾目标不是继续做大，而是收成一个可交付、可接入、可维护的小团队产品。

### 4.1 产品目标

把当前这条线收成：

- 可安装
- 可初始化
- 可接入 `Codex / Claude Code / Gemini CLI`
- 可运行最小任务闭环
- 可验证支持边界
- 可在团队内部试用

### 4.2 范围冻结建议

继续保留并做稳的能力：

- `protocol`
- `init / sync / status`
- `verify / report / delivery`
- repo-local hooks
- 基础 state / audit / gate
- 文档、模板、最小回归

明确冻结或降优先级的方向：

- 新增 CLI 子命令
- 宿主专属交互花活
- 更复杂的本地 wrapper 行为增强
- 与 control plane 无直接关系的局部技巧优化

### 4.3 对外定位

当前确认采用：

- `Agent Harness Runtime`

补充表述可使用：

- `repo-local agent runtime`
- `cross-host delivery runtime`

但正式主名以 `Agent Harness Runtime` 为准，不再对外把它包装成未来主产品全貌。

### 4.4 最低可产品化标准

要达到“可以给一些团队实际使用”，至少需要满足：

1. 三宿主最小链路稳定
   - `Codex`
   - `Claude Code`
   - `Gemini CLI`

2. 文档口径统一
   - 当前支持什么
   - 不支持什么
   - 稳定能力与实验能力怎么区分

3. 初始化和诊断可用
   - `init`
   - `sync`
   - `status`

4. 交付闭环可用
   - `verify`
   - `report`
   - `delivery`

5. 回归基线存在
   - 至少覆盖任务分类、宿主接入、关键 hook smoke test

### 4.5 明确冻结项

本轮确认以下事项进入冻结或强降优先级：

- 不再新增重要 CLI 子命令
- 不再围绕宿主体验做大量花活型增强
- 不再把本地 wrapper 能力扩张当成主线
- 除非直接提升 Runtime 可用性，否则不再投入宿主补丁型优化

---

## 5. 未来产品方向和定位

这个问题要一次定清，不然后面会一边修 runtime，一边讨论 control plane，持续内耗。

### 5.1 已确认统一结论

内部已确认统一为三句话：

1. `agent-harness` 当前阶段的主交付物，是一个可被团队使用的 runtime，而不是终局产品。
2. 下一阶段真正的主产品方向，是 `Agent Engineering Control Plane`。
3. runtime 是 control plane 的基础设施和 adoption 入口，不再单独演化成更大的 CLI 产品。

### 5.2 这样定的好处

- 对当前代码投入有清晰边界
- 对未来产品投入有清晰目标
- 不会陷入“要不要继续扩 CLI”的反复讨论
- 可以把当前资产完整继承到未来方向，而不是推倒重来

### 5.3 未来主产品的核心卖点

未来不再卖“更会补 harness”，而卖：

- 跨宿主一致性
- 组织级 policy as code
- evidence-backed delivery
- workflow pack 资产
- override / audit / approval
- agent 质量与风险洞察

---

## 6. 建议的阶段路线图

### Phase A：Runtime 收口

目标：

- 把当前实现收成一个可被团队试用的 runtime 产品

重点：

- 三宿主最小链路稳定
- 文档统一
- CLI 降级为 compatibility layer
- 最小回归和发布链路补齐

### Phase B：Runtime 抽核

目标：

- 让 repo-local hooks 对 CLI 的反向依赖下降

重点：

- 抽 runtime core
- 减少宿主脚本直连 `packages/cli` 内部路径
- 让 runtime 结构更适合未来上接 control plane

### Phase C：Control Plane 立项

目标：

- 正式把未来主产品从“runtime 工具”切到“组织控制面”

重点：

- 统一对象模型
- 明确 MVP 页面
- 明确 deployment 和 API 形态
- 明确 runtime 与 control plane 的边界协议

---

## 7. 接下来 4 到 6 周建议

### 第 1 到 2 周

- 完成 runtime 定位收口
- 补齐 README / 使用指南 / 包说明的一致口径
- 冻结 CLI 扩张范围
- 补三宿主最小回归基线

### 第 3 到 4 周

- 把当前仓库内的 repo-local hooks 再做一轮结构收敛
- 梳理 runtime core 与 compatibility CLI 的边界
- 形成一个明确可发布的 runtime scope

### 第 5 到 6 周

- 输出 control plane 立项版 PRD v0.2
- 明确 runtime 与 control plane 的对象协议
- 明确是否进入产品原型或设计验证阶段

---

## 8. 本轮已确认的决策项

1. 正式接受“双层产品定义”
   - `Runtime`
   - `Control Plane`

2. 正式冻结 CLI 扩张
   - 只做收尾，不再深挖

3. 当前 4 到 6 周目标定义为“runtime 产品化收口”
   - 而不是继续探索更多 repo-local 能力

4. 下一阶段产品主线正式切到 `Agent Engineering Control Plane`

---

## 9. 最终建议

建议的最终口径是：

> 用 4 到 6 周把 `agent-harness` 收成一个可被小团队试用的 runtime 产品，同时停止把 CLI 继续做大；在此基础上，把未来主产品统一定义为 `Agent Engineering Control Plane`，后续新增战略投入全部围绕控制面展开。

这条路径的优点是：

- 不浪费已经投入的 `protocol + CLI + hooks` 资产
- 不继续在错误方向上扩大化
- 给未来主产品留下明确的基础设施和 adoption 入口
