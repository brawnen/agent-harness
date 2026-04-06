# Agent Harness 开源架构 ADR v0.1

## 1. 状态

Proposed

## 2. 背景

当前仓库已经验证了 Harness 的核心方向：用协议、状态模型、门禁规则和宿主适配约束 agent 行为。

但当前对外形态仍以 Ruby CLI 为中心，存在三个开源阻力：

1. 目标用户普遍有 Node.js，但不一定有 Ruby
2. 协议层和 CLI 工具层耦合，无法支持“只用协议，不装工具”
3. 安装方式依赖脚本和 PATH 配置，不适合作为社区默认入口

同时，项目对外名称已调整为 `agent-harness`。这意味着开源架构需要同步从“项目内嵌 Ruby 工具”转向“协议优先、工具可选、npm 分发优先”的形态。

## 3. 决策结论

### 3.1 分层决策

采用两层解耦架构：

- `protocol`：协议层，可独立使用
- `cli`：工具层，可选安装，依赖 `protocol`

两层放在同一个 monorepo 中维护，但职责边界必须明确。

### 3.2 CLI 语言决策

CLI 采用 Node.js 重写，不再以 Ruby 作为开源主入口。

原因：

- 目标用户默认具备 Node.js 环境
- npm / npx 是最低摩擦的分发路径
- 当前 Ruby CLI 规模可控，迁移成本可接受
- JSON、模板和文件生成逻辑更适合直接在 Node.js 中实现

### 3.3 分发决策

分发优先级如下：

1. `npx @<scope>/cli init`
2. `npm install -g @<scope>/cli`
3. `brew install <name>`（后续）
4. GitHub Releases 二进制（未来）

其中：

- `npx` 是默认推荐入口
- `protocol only` 不以安装 CLI 为唯一前提
- 文档必须把“直接复制协议规则”列为第一入口

### 3.4 包边界决策

`protocol` 与 `cli` 作为两个独立包存在，但共用一个仓库。

- `protocol` 负责规则、schema、模板、宿主适配示例
- `cli` 负责 init、status、verify、state、report、gate、audit 能力

约束：

- `cli` 可以依赖 `protocol`
- `protocol` 不能反向依赖 `cli`
- 协议规则不得只存在于 CLI 内部实现中

### 3.5 v0.1 发布边界决策

`v0.1` 只承诺两类发布物：

- `@brawnen/agent-harness-protocol`
- `@brawnen/agent-harness-cli`

其中：

- `@brawnen/agent-harness-protocol` 面向所有用户，强调零门槛传播
- `@brawnen/agent-harness-cli` 面向需要初始化、状态、门禁和审计闭环的用户

`update` 不进入 `v0.1` 发布范围。

原因：

- 当前首要目标是先稳定首次接入路径
- 其次是稳定本地状态、验证、报告、门禁和审计的最小闭环
- 跨版本升级器会显著扩大兼容面和测试面，不适合放进第一版发布承诺

## 4. 目标形态

### 4.1 Protocol Only

用户可以通过以下方式使用协议层：

- 直接复制规则块到 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`
- 使用 `npx <cli> init --protocol-only` 生成协议接入文件
- 单独引用 schema、任务模板和 adapter 示例

获得能力：

- L2 行为约束
- intake / clarify / observe / verify / report 的交互规范
- schema 与任务模板

### 4.2 Protocol + CLI

用户通过 `npx` 或全局安装启用工具层。

获得能力：

- 项目初始化
- 状态持久化
- 审计日志
- 验证门禁
- 宿主 hooks 接入

## 5. 仓库结构

建议结构如下：

```text
repo/
├── packages/
│   ├── protocol/
│   │   ├── package.json
│   │   ├── rules/
│   │   │   ├── base.md
│   │   │   └── full.md
│   │   ├── schemas/
│   │   ├── templates/
│   │   │   ├── bug.md
│   │   │   ├── feature.md
│   │   │   └── explore.md
│   │   └── adapters/
│   │       ├── claude-code/
│   │       ├── codex/
│   │       └── gemini-cli/
│   │
│   └── cli/
│       ├── package.json
│       ├── bin/
│       │   └── agent-harness
│       └── src/
│           ├── commands/
│           ├── services/
│           ├── fs/
│           └── index.ts
│
├── docs/
│   ├── adr/
│   ├── architecture/
│   └── migration/
├── README.md
├── LICENSE
└── CONTRIBUTING.md
```

## 6. 包职责

### 6.1 `@<scope>/protocol`

负责：

- 发布规则文本
- 发布 JSON Schema
- 发布任务模板
- 发布宿主适配示例

不负责：

- `init`
- `state`
- `audit`
- `gate`
- `verify`

### 6.2 `@<scope>/cli`

负责：

- `init`
- `status`
- `verify`
- `state`
- `report`
- `gate`
- `audit`

额外约束：

- CLI 读取 `protocol` 包中的规则和模板资源
- 不单独维护一份脱离 `protocol` 的协议副本
- CLI 可以消费 `protocol` 的发布产物，但不能要求“只想用协议”的用户必须先安装 CLI

## 7. init MVP 边界

本节记录的是第一阶段迁移时的 `init` MVP 约束；当前对外发布范围以第 11 节“v0.1 范围冻结”为准。

第一阶段只交付 Node 版 `init`，不要求一次性补齐全部长期能力。

### 7.1 必做能力

1. 检测项目类型
2. 检测宿主类型
3. 生成项目配置文件
4. 注入规则块
5. 输出宿主 adapter 样板
6. 支持 `--protocol-only`
7. 支持 `--dry-run`

### 7.2 明确不做

1. 不迁移完整 `state` 生命周期
2. 不迁移完整 `gate` 逻辑
3. 不迁移完整 `audit / report` 能力
4. 不实现复杂的跨宿主智能合并
5. 不承诺第一阶段就提供复杂升级兼容

## 8. init 命令契约

### 8.1 命令形态

```bash
npx @<scope>/cli init
npx @<scope>/cli init --protocol-only
npx @<scope>/cli init --host codex
npx @<scope>/cli init --rules base
npx @<scope>/cli init --dry-run
```

### 8.2 参数

- `--protocol-only`
  只写协议接入内容，不生成 CLI 运行时目录
- `--host <claude-code|codex|gemini-cli|auto>`
  指定宿主；默认自动推断
- `--rules <base|full>`
  选择规则粒度
- `--dry-run`
  只输出计划动作，不写文件
- `--force`
  覆盖 CLI 生成块
- `--yes`
  跳过交互确认

### 8.3 输出边界

`protocol-only` 模式至少应生成或更新：

- `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 中对应的规则块
- 协议使用说明或模板引用

`protocol + cli` 模式至少应生成或更新：

- 项目配置文件
- 宿主规则块
- 运行目录占位
- hooks 配置样板

## 9. 配置文件策略

当前阶段允许继续使用 `harness.yaml` 作为过渡配置名，但要明确它不是最终品牌绑定决策。

候选方向：

- `.agent-harness.json`
- `.task-harness.json`
- `harness.yaml`（过渡兼容）

结论：

- 第一阶段实现可继续兼容 `harness.yaml`
- 在 README 与迁移文档中要明确标记其为过渡命名

## 10. 实施顺序

以下顺序记录的是初始迁移计划，当前是否进入发布承诺以第 11 节为准。

### Phase 1

- 固化 monorepo 结构
- 抽出 `protocol` 包
- 实现 Node 版 `init`
- 调整 README 为 protocol-first 叙事

### Phase 2

- 迁移 `status`
- 迁移 `verify`
- 迁移 `state` 的最小读写能力

### Phase 3

- 迁移 `gate` / `audit` / `report`
- 补齐宿主 hooks 自动接入
- 评估 Homebrew 和二进制分发

## 11. v0.1 范围冻结

### 11.1 包含项

- `protocol` 独立分包
- `cli` 的 `init / status / state / verify / report / gate / audit` MVP
- 本地 JSON 状态持久化
- 基础宿主规则注入与接入样板

### 11.2 非目标

- `update` 命令
- 复杂升级器
- 跨宿主深度自动 merge
- Homebrew 和预编译二进制分发

上述非目标不是“永远不做”，而是明确延后到 `v0.1` 之后，避免第一版发布目标失焦。

## 12. 风险与约束

### 12.1 主要风险

1. 命名如果长期不冻结，后续 README、包名、配置名会重复迁移
2. 如果 init MVP 顺手扩展到 verify / state / gate，会导致周期失控
3. 如果 `protocol` 仍然隐式依赖 CLI，解耦会名存实亡

### 12.2 当前约束

- 当前文档和状态文件仍位于 `harness/` 目录下
- `harness.yaml` 仍是过渡配置名
- 宿主 hooks 自动集成仍未完全收口

## 13. 直接后果

正面影响：

- 首次接入门槛显著下降
- 协议可以独立传播和复用
- 分发方式与目标用户环境一致
- 结构更适合社区贡献

代价：

- 需要承担 Node 重写成本
- 需要明确一份迁移文档管理过渡期差异

## 14. 本文用途

本文是后续以下工作的约束依据：

- monorepo 目录调整
- `packages/protocol` 抽取
- `packages/cli` 初始化
- README 开源叙事重写
- 发布边界与后续宿主接入收口
