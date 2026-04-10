# ADR: Runtime P0 收尾范围与验收基线

## 背景

当前项目已经决定把现有 `agent-harness` 收敛为 `Agent Harness Runtime`，并冻结 `CLI` 的继续扩张。

在这个前提下，P0 收尾的重点不是新增能力，而是让 Runtime 达到小团队可试用的最低标准：

- 三宿主最小链路稳定
- 文档口径统一
- 关键命令可理解、可验证
- 回归基线存在
- 试用路径清楚

## 决策

本轮 P0 收尾采用以下策略：

1. `init/sync` 生成物统一指向 repo-local hooks 或 compatibility CLI 的真实入口
2. 为 `Codex / Claude Code / Gemini CLI` 补齐最小宿主 smoke 和 init/status 回归
3. 把 `Agent Harness Runtime`、compatibility CLI、试用边界和非目标写入 README / usage guide / package README
4. 新增小团队试用清单，作为外部试用的最低行动指南

## 影响

正面影响：

- Runtime 已具备更完整的对外试用闭环
- 三宿主接入不再只靠手工验证
- 文档口径和当前实现更一致

代价与边界：

- 这轮仍未进入 Runtime core 抽离阶段
- 部分 repo-local hooks 仍通过运行时模块解析依赖 CLI 包内部模块
- 组织级治理、审批和洞察仍属于后续 `Control Plane` 方向，不纳入 Runtime P0
