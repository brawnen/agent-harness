# ADR: 完成开源发布前的最后一轮收口，包括 MIT、npm README、CLI 对 protocol 的显式依赖、workflow_policy warn、交互节奏规则和匿名化清理

## 状态

Proposed

## 背景

- task_id: `p16-open-source-release-prep`
- intent: `feature`
- risk_level: `low`
- goal: 完成开源发布前的最后一轮收口，包括 MIT、npm README、CLI 对 protocol 的显式依赖、workflow_policy warn、交互节奏规则和匿名化清理

## 决策

- 采用 `MIT` 作为当前仓库与两个 npm 子包的许可证
- npm 包页采用“英文 `README.md` 为默认展示页，中文说明放在 `README.zh-CN.md`”的策略
- `@agent-harness/cli` 通过 npm 显式依赖 `@agent-harness/protocol`，而不是在 CLI 包里复制一份 protocol 资源
- `workflow_policy` 当前进入 `warn`，先做告警而不是硬门禁
- 将交互节奏规则正式写入 protocol rules 与主设计文档，而不是只停留在口头约定

## 后果

- 正面影响：
  - npm 发布边界更清晰，安装 `@agent-harness/cli` 时会自动带上 protocol
  - 开源包面对全球开发者时，npm 页面默认展示英文说明
  - 仓库不再暴露原始姓名和本机绝对路径
  - 交互节奏规则成为正式协议的一部分，可复用于不同宿主
- 代价与风险：
  - 包级 README 改名带来一轮文档与链接迁移
  - `warn` 模式会增加状态输出中的告警信息
  - 当前仍需后续真正执行 `npm publish` 才算完成公开发布

## 影响范围

- package.json
- .gitignore
- LICENSE
- harness.yaml
- README.md
- README.en.md
- docs/**
- packages/cli/**
- packages/protocol/**
