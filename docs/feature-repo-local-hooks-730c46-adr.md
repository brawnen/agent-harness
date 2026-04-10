# ADR: Runtime P1 稳定入口与兼容边界收口

## 背景

`Runtime P0` 完成后，repo-local hooks 已经成为当前宿主接入主路径，但 hook 脚本仍通过 loader 直接引用 `packages/cli/src/**` 的内部模块。

这会带来两个问题：

- runtime 与 compatibility CLI 的边界仍然不够清晰
- 外部仓库虽然能跑，但接入层仍然绑定了 CLI 内部实现细节

同时，`status` 已经具备识别新旧宿主接入方式的基础能力，但缺少一条明确的兼容边界回归。

## 决策

本轮 `P1` 收尾采用以下方案：

1. 抽出稳定的 runtime host 入口 `@brawnen/agent-harness-cli/runtime-host`
2. repo-local hooks 默认只依赖该稳定入口，不再直接依赖 `src/lib/hook-core.js`、`src/lib/hook-io/*`、`src/lib/state-store.js`
3. 保留 loader 对旧内部路径的兼容解析，但不再作为新接入面继续推广
4. 为 `status + sync` 增补一条新旧布局兼容回归，明确：
   - `status` 识别 legacy CLI hook 命令
   - `sync` 把 legacy 配置收敛回 repo-local hooks 模板
5. 把稳定面、兼容面、非目标和 CLI 冻结面写成单独文档

## 结果

完成本轮后：

- repo-local hooks 有了明确稳定入口
- Runtime 与 compatibility CLI 的职责边界更清晰
- 当前仓库可以作为 Runtime 参考实现继续维护
- 后续再讨论新需求时，可以先判断是否越过稳定面或命中冻结面

## 非目标

本轮不做：

- 新增 CLI 子命令
- 独立 runtime npm 包拆分
- 组织级控制面能力
- 更深的单宿主体验打磨
