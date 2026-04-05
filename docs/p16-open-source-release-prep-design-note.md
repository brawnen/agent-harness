# Design Note: 收口开源发布准备：补 MIT 许可证、npm README 策略、CLI 显式依赖 protocol、workflow_policy warn、交互节奏规则，以及仓库匿名化清理

## 背景

- task_id: `p16-open-source-release-prep`
- intent: `feature`
- risk_level: `low`

## 目标

- 收口开源发布准备：补 MIT 许可证、npm README 策略、CLI 显式依赖 protocol、workflow_policy warn、交互节奏规则，以及仓库匿名化清理

## 作用范围

- `package.json`
- `.gitignore`
- `LICENSE`
- `harness.yaml`
- `README.md`
- `README.en.md`
- `docs/**`
- `packages/cli/**`
- `packages/protocol/**`

## 方案

- 为根仓库、`packages/cli`、`packages/protocol` 统一补齐 MIT 许可证文本与 license 元数据
- 把包级 npm README 收口成英文 `README.md` 为默认展示页，中文说明迁到 `README.zh-CN.md`
- 让 `@agent-harness/cli` 显式依赖 `@agent-harness/protocol`，并在 `init` 中优先从已安装依赖解析 protocol 资源
- 将 `workflow_policy` 默认 enforcement 从 `recommend` 升到 `warn`，但保持只告警不阻断
- 把“确认前给方案、确认后只执行、最终不复读”写入 protocol rules、设计文档和 usage guide
- 清理仓库中的本机绝对路径与原始姓名暴露，统一改为相对路径和 `brawnen`

## 风险与权衡

- npm 发布包仍需以实际 `npm publish` 为准，当前只验证到 `npm pack --dry-run`
- `workflow_policy warn` 会增加输出噪音，但比直接进入 `strict` 更安全
- 包级 README 改名会影响仓库内链接，因此需要同步修正中英文首页与包入口
- 匿名化清理只改仓库文本，不修改本机真实目录，避免引入运行时路径回归

## 验证计划

- `npm run release:pack:protocol`
- `npm run release:pack:cli`
- `node packages/cli/bin/agent-harness.js status`
- `node packages/cli/bin/agent-harness.js delivery ready --task-id p16-open-source-release-prep`
- 运行匿名化关键字搜索，确认仓库中不再出现原始姓名
