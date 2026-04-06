# @brawnen/agent-harness-protocol

[English](README.md)

这个包承载 `agent-harness` 的协议层资源：

- `rules/`：协议规则文本
- `schemas/`：JSON Schema
- `templates/`：任务模板
- `adapters/`：宿主适配示例

设计约束：

- 这个包必须可独立使用
- 协议规则不能只存在于 CLI 内部
- CLI 可以依赖这个包，但这个包不能反向依赖 CLI

当前状态：

- `schemas/` 与 `templates/` 已进入 `packages/protocol`
- `rules/` 已拆出 `base.md` 与 `full.md`
- `adapters/` 先提供宿主接入说明和示例配置
