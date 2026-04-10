# CLI 收口与 Agent-Native Runtime 迁移方案 v0.1

## 结论

`CLI` 不再继续作为 `agent-harness` 的主产品形态深挖。

后续产品中心应明确收敛到：

- 宿主内的 repo-local hooks / runtime
- 协议规则、状态机和交付门禁
- 针对不同 agent host 的一致控制面

`packages/cli` 保留，但职责收缩为：

- `init / sync / status` 等 bootstrap 与诊断入口
- `verify / report / delivery` 等显式人工动作
- hook 失败时的 manual fallback

## 为什么现在要收口 CLI

当前实现暴露出三个结构性问题：

1. 用户真正感知的是 agent 在宿主中的行为，而不是单独执行 CLI 命令。
2. 把核心工作流长期压在 CLI 上，会让产品持续围绕“命令面扩张”而不是“agent 内部收敛”演进。
3. 宿主已经具备 hook / prompt / completion gate 等接入点，再继续深化 CLI，只会让 runtime 依赖方向越来越反直觉。

## 目标形态

目标架构应调整为：

1. `protocol`
   - 负责规则、模板、schema、适配说明
2. `repo-local host runtime`
   - 负责 `SessionStart / PromptSubmit / BeforeTool / AfterTool / CompletionGate`
   - 直接承载任务状态流转、门禁判断和证据记录
3. `compatibility CLI`
   - 负责初始化、状态诊断、手动验证、显式报告与交付

换句话说：runtime 由 agent 感知，CLI 由人类在需要时显式触发。

## 本次落地的第一步

本次代码改动先完成一轮“依赖方向调整”，不做大拆包：

- `Codex` 的 `SessionStart / UserPromptSubmit` 不再二次起一个 CLI 进程，而是直接调用 hook 核心逻辑
- 当前仓库的 `Claude Code / Gemini CLI` 改为通过 repo-local hook 脚本承载宿主接入
- `status` 开始同时识别“旧 CLI 命令入口”和“新的 repo-local hook 入口”
- README 与 CLI README 明确把 CLI 定位成 compatibility layer

这一步的价值不是删 CLI，而是先让宿主 runtime 不再把 CLI 当唯一中心。

## 产品路线图

### Phase 1: CLI 降级为兼容层

- 完成当前仓库自举链路的 repo-local runtime 化
- 文档口径统一改为“hooks/runtime 为主，CLI 为辅”
- 不删除现有命令，避免打断已有用户路径

### Phase 2: 抽 runtime core

- 从 `packages/cli` 中抽出稳定的 host/runtime core
- 减少 `.harness/hosts/*` 对 CLI 源目录的反向依赖
- 让 repo-local hooks 可以更独立地运行

### Phase 3: CLI 收口

- 冻结新增 CLI 子命令
- 优先投资 host adapter、规则策略、runtime state 和 evidence 流
- 保留 `init / sync / status / verify / report / delivery`，其余命令视使用价值收缩

### Phase 4: 产品重定位

- 对外产品定义从“CLI 工具”调整为“agent engineering control plane”
- CLI 变为次级交付物，而不是品牌中心

## 设计原则

- 不一次性删除 CLI，优先做兼容降级
- 不把简单问题升级成大规模拆包
- 先调整依赖方向，再抽公共 runtime
- 先保证当前仓库自举链路稳定，再讨论跨仓库分发形态

## 风险与后续

当前仍有一个未完全解决的问题：

- 一部分 repo-local hook 代码仍然直接复用 `packages/cli` 下的核心库，尚未形成独立 runtime 包

这不是本次要一次性解决的点，但必须被视为下一阶段主任务，而不是继续给 CLI 加更多命令面。
