# CHANGELOG 维护规范 v0.1

## 目标

统一 `agent-harness` 仓库中 `CHANGELOG.md` 的维护方式，确保 review 时能快速看出：

- 哪一天新增了哪些功能或约束
- 这些内容当前是否仍处于 `Unreleased`
- 正式发布时如何从 `Unreleased` 切换到版本化记录

## 基本规则

### 1. 日常开发阶段统一写入 `Unreleased`

所有尚未正式发布的改动，都先记录在：

```md
## Unreleased
```

不要在日常开发阶段把小节改成 `Released`。

### 2. `Unreleased` 下按日期分组

每次新增 changelog 内容时，必须写在一个日期小节下：

```md
## Unreleased

### 2026-04-04

- 增加 Codex E2E 回归脚本
- 启用 output_policy 的 changelog / design_note / adr 校验
```

这里的时间要求只到“日期”，不要求精确到时分秒。

### 3. 发布时不改成 `Released`

正式发布时，应将 `Unreleased` 中要发布的内容切成一个明确版本小节：

```md
## 0.3.0 - 2026-04-04
```

然后重新创建一个空的：

```md
## Unreleased
```

因此发布动作的语义是：

- `Unreleased -> 具体版本号 + 发布日期`

而不是：

- `Unreleased -> Released`

## 推荐格式

推荐最小格式如下：

```md
# Changelog

All notable changes to `agent-harness` will be documented in this file.

## Unreleased

### 2026-04-04

- 增加 Codex E2E 回归脚本
- 启用 output_policy 的 changelog / design_note / adr 校验
```

## 与 output_policy 的关系

当前仓库已启用：

- `output_policy.changelog`

这意味着：

- `bug / feature / refactor` 任务在满足条件时需要更新 `CHANGELOG.md`
- CLI 当前检查的是 changelog 文件存在性
- 日期分组规则属于仓库维护规范，后续若需要，可再升级为更严格的自动校验

## 后续演进

后续可以继续补两类能力：

1. 发布流程
   - 将 `Unreleased` 自动切成 `x.y.z - YYYY-MM-DD`

2. 更严格的 changelog 校验
   - 检查 `Unreleased` 下是否存在日期小节
   - 检查当天新增项是否符合最小格式
