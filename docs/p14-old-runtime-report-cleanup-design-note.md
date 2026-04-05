# Design Note: 把迁移到 .harness 后遗留的旧 harness/reports 跟踪文件从 git 中清理掉

## 背景

- task_id: `p14-old-runtime-report-cleanup`
- intent: `refactor`
- risk_level: `low`

## 目标

- 把迁移到 .harness 后遗留的旧 harness/reports 跟踪文件从 git 中清理掉

## 作用范围

- harness/reports
- CHANGELOG.md

## 方案

- 删除迁移到 `.harness/` 之后仍被 Git 跟踪的旧 `harness/reports/*.json` 文件。
- 保留新的 `.harness/reports/` 作为唯一运行时报告目录。
- 在 `CHANGELOG.md` 中补一条清理说明，避免后续回看迁移历史时遗漏这次 follow-up。

## 风险与权衡

- 旧报告文件会从当前工作树中移除，但历史 commit 仍然保留它们的版本记录。
- 本次不改运行时逻辑，只清理迁移后遗留的版本控制噪音，风险较低。

## 验证计划

- `git status --short` 不再出现旧 `harness/reports/*.json` 删除项。
- `agent-harness verify --task-id p14-old-runtime-report-cleanup` 通过。
- `delivery commit` 可正常完成本地提交。
