# Agent Harness Runtime 收尾执行清单 v0.1

> 日期：2026-04-10
> 状态：P0 / P1 已完成，P2 待执行
> 目标周期：4 到 6 周
> 依赖决议：
> - `2026-04-10-product-layering-and-roadmap-decision-v0.1.md`
> - `2026-04-10-cli-closure-agent-native-transition-plan-v0.1.md`

> 2026-04-10 执行更新：
> - `3.1` 到 `3.5` 已按本轮收尾要求落地
> - `4.1` 到 `4.3` 已按本轮收尾要求落地
> - 当前剩余事项仅保留 `P2` 延后项

---

## 1. 收尾目标

本清单的目标不是继续扩大 `CLI` 或 repo-local wrapper 的能力，而是把当前 `agent-harness` 收成一个可被小团队实际试用的 `Runtime` 产品。

本轮收尾完成后，至少应满足：

- 团队可以完成安装、初始化、接入和最小使用
- 三宿主最小链路有真实验证
- 当前支持边界和非目标足够清楚
- 发布、文档、回归基线具备最低可维护性

---

## 2. 执行原则

- 只做收尾，不继续扩方向
- 优先补稳定性、文档、验证、发布闭环
- 任何新增工作都要回答一个问题：是否直接提升 Runtime 可试用性
- 不能直接提升 Runtime 可试用性的需求，默认延后到 Control Plane 阶段

---

## 3. P0 必做项

### 3.1 产品与文档口径统一

目标：

- 把当前产品统一表述为 `Agent Harness Runtime`

任务：

- 更新根 README 中的产品定位、快速开始和能力边界
- 更新 `packages/cli` README，把 CLI 明确写成 compatibility layer
- 更新使用指南，统一 `Codex / Claude Code / Gemini CLI` 的当前接入说明
- 在关键文档中明确：
  - 当前支持什么
  - 当前不支持什么
  - 哪些是稳定能力
  - 哪些仍是兼容或过渡能力

验收：

- 新用户只看 README 和使用指南，就能理解 Runtime 是什么、CLI 是什么、Control Plane 又是什么

### 3.2 三宿主最小链路做稳

目标：

- `Codex / Claude Code / Gemini CLI` 都有可运行的最小闭环

任务：

- 检查 `init --host codex`
- 检查 `init --host claude-code`
- 检查 `init --host gemini-cli`
- 确认生成后的宿主配置指向 repo-local hooks 或兼容 CLI 的真实入口
- 确认 `status` 能识别三宿主当前真实接入状态

验收：

- 三宿主都能完成：
  - 初始化
  - `status`
  - 最小 task / verify / report 路径说明

### 3.3 Runtime 核心命令收尾

目标：

- 把当前真正对团队试用有价值的命令做稳

收尾范围：

- `init`
- `sync`
- `status`
- `verify`
- `report`
- `delivery`

任务：

- 为每个命令补最小使用说明
- 明确输入输出、失败提示和边界
- 清理明显误导性的历史表述
- 确认这些命令足以支撑最小试用闭环

验收：

- 不依赖阅读源码，团队也能理解这些命令如何使用

### 3.4 回归基线建立

目标：

- 把当前 Runtime 最容易回归的地方补成最小基线

任务：

- 保留并补齐任务分类 fixture 回归
- 保留并补齐宿主 hook smoke test
- 至少覆盖：
  - task intake / continue / override 关键路径
  - Codex hooks
  - Claude Code hooks
  - Gemini CLI hooks
  - `status` 对三宿主的识别

验收：

- 每次关键调整后，都能跑一组最小验证证明 Runtime 没被破坏

### 3.5 发布与试用闭环

目标：

- 让外部小团队真的能开始试用

任务：

- 核对 npm 包说明与仓库文档一致
- 明确推荐接入路径
  - npm
  - protocol-only
  - 本地开发版
- 补一个“小团队试用清单”
  - 适合什么项目
  - 不适合什么项目
  - 试用步骤
  - 失败 fallback

验收：

- 外部试用者可以按文档完成第一次接入，不需要额外口头解释

---

## 4. P1 应做项

### 4.1 Runtime 结构再收敛

目标：

- 减少 repo-local hooks 对 `packages/cli` 内部路径的反向依赖

任务：

- 识别当前 hook 直接引用 `packages/cli/src/**` 的位置
- 抽出最小 runtime core 边界
- 让宿主脚本更多依赖稳定入口，而不是 CLI 内部实现细节

验收：

- Runtime 和 compatibility CLI 的职责边界更清晰

### 4.2 当前仓库自举链路再清扫

目标：

- 让本仓库成为 Runtime 的参考实现

任务：

- 检查 `.harness/hosts/*`、`.codex/.claude/.gemini`、规则文件之间是否还有口径漂移
- 检查 `sync` 与 `status` 对新旧布局的兼容边界
- 清理已经不符合当前方向的文案和遗留表述

验收：

- 当前仓库可以作为 Runtime 的参考接入样板

### 4.3 明确稳定面与冻结面

目标：

- 给后续维护设边界

任务：

- 列出 Runtime 当前稳定能力
- 列出 Runtime 当前非目标
- 列出进入冻结状态的 CLI 方向

验收：

- 后续讨论新需求时，可以直接判断是否应该拒绝或延后

---

## 5. P2 可延后项

这些事项不是本轮收尾阻断，默认不应抢占主线：

- 新增 CLI 子命令
- 更复杂的 Bash 解析增强
- 更多宿主专属交互优化
- 更复杂的本地 UI 或可视化
- 大规模 workflow pack 扩张
- 围绕单宿主体验的深度打磨

---

## 6. 建议时间表

### 第 1 周

- 定位与文档口径统一
- Runtime 命令范围冻结
- 三宿主当前状态盘点

### 第 2 周

- 三宿主最小链路补验证
- `status / init / usage guide` 收口
- README 和包说明统一

### 第 3 周

- 回归基线补齐
- 当前仓库自举链路清扫
- 发布路径核对

### 第 4 周

- Runtime 结构再收敛
- 抽 runtime core 的最小边界
- 形成可对外试用的收尾版本

### 第 5 到 6 周

- 做一轮团队试用反馈
- 修 P0/P1 级别问题
- 输出 Runtime v0.x 收尾结论文档

---

## 7. 每周检查问题

每周只问这 5 个问题：

1. 本周做的事，是否直接提升了 Runtime 可试用性？
2. 是否又无意识扩大了 CLI 或宿主补丁型能力？
3. 三宿主最小链路有没有变得更稳，而不是更复杂？
4. 文档是否比代码更落后？
5. 哪些问题应该明确延后到 Control Plane，而不是继续塞进 Runtime？

---

## 8. 收尾完成标准

当以下条件同时满足时，可认为 Runtime 收尾基本完成：

1. `Agent Harness Runtime` 的产品定位已统一
2. `CLI` 已明确降级为 compatibility layer
3. 三宿主最小链路已验证
4. `init / sync / status / verify / report / delivery` 已可支撑试用
5. 文档、回归、发布说明达到最小可维护水平
6. 后续新增投入已明确转向 `Agent Engineering Control Plane`

---

## 9. 本轮不做的事

本轮明确不做：

- 不把 Runtime 做成更大的 CLI 平台
- 不把 repo-local harness 做成未来主产品终局
- 不在 Runtime 阶段承接组织级控制面需求
- 不因为已有投入而继续扩大错误方向

一句话：

> 这轮的目标是把已有资产收成一个可用产品，不是继续把它做成更大的产品。
