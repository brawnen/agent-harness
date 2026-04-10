# Agent Harness Runtime 小团队试用清单 v0.1

## 适合试用的项目

- 已经在真实仓库里使用 `Codex`、`Claude Code` 或 `Gemini CLI`
- 希望把任务范围、验证和交付收口做得更明确
- 能接受 repo 内新增 `.harness/` 运行时目录
- 团队规模不大，愿意先试一套轻量约束

## 不适合试用的项目

- 一次性 PoC、玩具项目、临时脚本
- 完全不希望引入流程约束
- 只把 agent 当问答助手，不让它执行写操作
- 希望一开始就获得组织级控制台、审批和洞察能力

## 推荐试用步骤

1. 先选一个 `Codex` 项目接入
2. 执行 `npx @brawnen/agent-harness-cli init --host codex`
3. 执行 `npx agent-harness status`
4. 跑一个最小闭环：
   - `task intake`
   - `verify`
   - `report`
   - `delivery ready`
5. 再选一个 `Claude Code` 或 `Gemini CLI` 项目验证跨宿主边界

## 推荐观察点

- agent 是否更少越界
- 任务是否更容易续接
- 完成是否更有证据
- 高风险动作是否更容易被拦住
- 团队是否能接受这套交付节奏

## 失败 fallback

- 如果宿主 hooks 不稳定，先退回 `protocol-only`
- 如果自动链路有问题，可手动使用 compatibility CLI：
  - `status`
  - `task intake`
  - `verify`
  - `report`
- 如果项目不适合 `.harness/` 运行时目录，先不要继续推广

## 当前试用边界

- 当前最完整宿主仍是 `Codex`
- `Claude Code` 与 `Gemini CLI` 已有最小闭环，但不追求深度宿主体验增强
- `CLI` 现在是 compatibility layer，不是未来主产品中心
- 组织级策略中心、审批、洞察等能力属于后续 `Control Plane` 方向

相关边界定义见：

- [Runtime 稳定面与冻结面](2026-04-10-runtime-stability-surface-and-frozen-scope-v0.1.md)
