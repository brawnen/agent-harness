# Agent Harness Runtime 稳定面与冻结面 v0.1

> 日期：2026-04-10
> 状态：当前有效

## 1. 定位

当前 `agent-harness` 的正式产品定位是 `Agent Harness Runtime`。

它负责：

- 在仓库内提供统一的任务协议、状态、验证与交付收口
- 为 `Codex`、`Claude Code`、`Gemini CLI` 提供 repo-local host hooks 接入
- 通过 compatibility CLI 提供初始化、诊断、手动 fallback 和发布入口

它不再承担“继续长成一个更大的 CLI 产品”的目标。

## 2. 当前稳定面

以下能力视为当前 `Runtime` 的稳定面：

- 核心命令面：
  - `init`
  - `sync`
  - `status`
  - `verify`
  - `report`
  - `delivery`
- 宿主源目录布局：
  - `.harness/hosts/*`
  - `.harness/rules/*`
  - `.codex/.claude/.gemini` 作为薄壳入口
- 三宿主最小链路：
  - `Codex`
  - `Claude Code`
  - `Gemini CLI`
- repo-local hooks 对 runtime 的稳定入口：
  - `@brawnen/agent-harness-cli/runtime-host`
- 当前仓库参考实现：
  - `sync --check` 应保持无 drift
  - `.harness/hosts/*` 是宿主脚本 source of truth

## 3. 当前兼容面

以下能力保留为兼容或过渡能力，不应继续扩张：

- Node.js CLI 作为 compatibility layer
- 旧版 `CLI` hook 命令形式的宿主配置
- loader 中对内部文件路径的兼容解析

当前兼容边界约定如下：

- `status` 需要能识别旧版 `CLI` hook 命令和新版 repo-local hooks
- `sync` 需要把旧版宿主配置收敛回当前 repo-local hooks 模板
- 新接入默认生成 repo-local hooks，不再推荐继续新增 legacy CLI wrapper 配置

## 4. 当前非目标

以下方向不属于当前 `Runtime` 主线：

- 新增重要 CLI 子命令
- 更复杂的 Bash 解析增强
- 更多宿主专属交互优化
- 更复杂的本地 UI 或可视化
- 大规模 workflow pack 扩张
- 组织级策略中心、审批、洞察和控制台能力

## 5. CLI 冻结面

`CLI` 当前进入冻结状态，默认只允许以下类型变更：

- bug fix
- 回归修复
- 文档澄清
- 与 repo-local hooks 对齐所必需的兼容修正

默认不再接受以下扩张：

- 把 CLI 做成新的主交互中心
- 围绕单宿主继续做深度 wrapper 能力
- 为了 CLI 完整性而扩大 Runtime 范围

## 6. 验证基线

当前建议使用以下命令验证稳定面与兼容边界：

```bash
npm run runtime:p0:check
npm run runtime:p1:check
node packages/cli/bin/agent-harness.js sync --check
node packages/cli/bin/agent-harness.js status
```
