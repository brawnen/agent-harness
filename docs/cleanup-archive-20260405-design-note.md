# Design Note: 清理 harness 历史副本并归档 docs 历史设计文档

## 背景

- task_id: `cleanup-archive-20260405`
- intent: `refactor`
- risk_level: `low`

## 目标

- 清理 harness 历史副本并归档 docs 历史设计文档

## 作用范围

- harness.yaml
- harness/tasks/
- docs/
- README.md
- README.en.md

## 方案

- 删除 `harness/examples/`、`harness/templates/` 和 `harness/schemas/`，统一以 `packages/protocol/schemas/` 作为唯一 schema 主线来源。
- 更新 `harness.yaml`，移除已不存在的旧设计文档路径、Ruby 校验命令和过时的 `harness/*.md` 风险范围。
- 将早期设计与 spec 文档移动到 `docs/archive/`，把 `docs/` 根目录收口为当前主线设计、roadmap 和 workflow 文档。
- 同步更新 `README` 与 `v0.3` 设计文档，明确 `docs/archive/` 用于历史草稿和早期规格归档。

## 风险与权衡

- 删除 `harness/schemas/` 后，任何仍直接依赖该目录的隐性脚本都会失效；本次先通过主线引用检查和 CLI 状态检查确认没有活跃依赖。
- 早期文档迁移到 `docs/archive/` 后，历史链接路径会变化，因此需要同步修正主线入口，避免用户从 README 误入过时资料。
- 这次只做归档，不删除早期核心设计内容，保留后续回溯和宿主扩展参考价值。

## 验证计划

- 确认 `harness/` 只剩运行时目录和任务模板目录。
- 确认主线 README、`v0.3` 设计文档已说明 `docs/archive/` 的存在。
- 运行 `agent-harness status`，确认清理后主链路仍可执行。
- 扫描主线文档，确认不再引用被移动文档的旧路径。
