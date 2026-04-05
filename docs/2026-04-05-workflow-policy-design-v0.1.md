# Workflow Policy Design v0.1

## 背景

`agent-harness` 当前默认按完整链路收口任务：

- `task intake / confirm`
- `verify`
- `report`
- `delivery`

这条路径对代码改动、配置变更、宿主接入和交付策略类任务是合理的，但对极小、低风险、单文件、无行为变化的任务会偏重。  
因此需要一套 `workflow_policy`，让系统能自动判断当前任务更适合走：

- `full`
- `lite`

## 设计目标

1. 默认仍然保守，优先 `full`
2. 允许系统推荐 `lite`
3. 当风险上升时，允许自动从 `lite` 升级到 `full`
4. 不允许自动从 `full` 降级到 `lite`
5. 第一版先做推荐和升级，不直接做严格硬门禁

## 核心概念

### workflow_mode

任务当前实际采用的流程模式：

- `full`
- `lite`

### workflow_decision

系统对流程模式的判定结果，建议至少包含：

- `recommended_mode`
- `effective_mode`
- `reasons`
- `upgraded_from`
- `evaluated_at`

示例：

```json
{
  "recommended_mode": "lite",
  "effective_mode": "full",
  "upgraded_from": "lite",
  "reasons": [
    "multi_file_scope",
    "output_artifact_required"
  ],
  "evaluated_at": "2026-04-05T11:00:00+08:00"
}
```

## 流程模式定义

### full

完整链路，适用于：

- 行为变更
- 配置或协议变更
- 跨文件或跨模块改动
- 需要 `changelog / design_note / adr`
- 高风险或需要追溯的任务

典型链路：

1. `task intake`
2. `task confirm`
3. `verify`
4. `report`
5. `delivery`

### lite

简化链路，适用于：

- 单文件
- 低风险
- 文档、注释、typo 或无行为变化的小修
- 不涉及配置、协议、宿主规则、交付策略
- 不需要额外交付工件

`lite` 不等于无状态。  
它仍应保留最小任务记录和最小验证，只是减少完整收口动作。

## 判定时机

### 1. intake / confirm 初判

目标：给任务一个初始推荐模式。

输入：

- `intent`
- `risk_level`
- `scope`
- `constraints`
- `output_policy` 是否可能触发

输出：

- `recommended_mode`
- `reasons`

### 2. report / delivery 前复判

目标：根据真实改动范围决定是否必须升级到 `full`。

输入：

- `actual_scope`
- `output_artifacts`
- `override_history`
- `delivery_policy`
- 是否跨文件
- 是否命中高风险路径

输出：

- `effective_mode`
- 必要时记录 `upgraded_from=lite`

## 推荐判定规则

### 自动判定为 full

命中任一条即可：

- `intent` 为 `bug`
- `intent` 为 `feature`
- `intent` 为 `refactor`
- scope 跨多个文件或目录
- 改配置、schema、rules、hooks、protocol、CLI 命令
- 需要 `changelog`
- 需要 `design_note`
- 需要 `adr`
- 命中高风险路径
- 使用了 `override`
- 真实提交范围不是单文件纯文档

### 允许推荐为 lite

必须同时满足：

- 单文件
- 低风险
- `docs-only / comment-only / typo-only / 无行为变化小修`
- 不改配置、协议、宿主规则
- 不需要 `changelog / design_note / adr`
- 不存在交付范围判断困难

### 升级规则

- 允许：`lite -> full`
- 不允许：`full -> lite`

如果无法稳定判断，默认使用 `full`。

## 建议配置结构

```yaml
workflow_policy:
  default_mode: full

  lite_allowed_if:
    single_file: true
    low_risk: true
    docs_only: true
    no_behavior_change: true
    no_policy_change: true
    no_output_artifacts: true

  force_full_if:
    intents: [bug, feature, refactor]
    multi_file_scope: true
    config_changed: true
    protocol_changed: true
    host_adapter_changed: true
    output_artifact_required: true
    high_risk: true
    override_used: true

  enforcement:
    mode: recommend
    upgrade_only: true
```

## 建议接入点

### task-core

职责：

- 负责初判
- 输出 `recommended_mode`

### status

职责：

- 展示当前推荐模式
- 展示升级原因
- 标记是否已从 `lite` 升级到 `full`

### report

职责：

- 复判
- 若任务已被升级为 `full`，则不允许跳过完整收口

### delivery

职责：

- 若任务要求 `full`，则不允许绕过关键交付工件

## Enforcement 方向

建议分三档推进：

- `recommend`
  - 只提示推荐模式和升级原因
- `warn`
  - 在不符合推荐模式时给出明显告警
- `strict`
  - 对关键场景执行硬门禁

第一版建议使用：

```yaml
enforcement:
  mode: recommend
```

## 风险与边界

1. `是否改了行为` 在 intake 时很难 100% 准确判断
2. `docs-only` 与 `comment-only` 的识别需要结合真实改动范围
3. 如果一开始直接使用 `strict`，误伤率会偏高

因此第一版必须保守：

- 能确认需要 `full` 时才升级
- 不能确认时，默认 `full`

## 推荐实施顺序

1. 在配置层引入 `workflow_policy`
2. 在 `task-core` 做初判
3. 在 `status` 展示结果
4. 在 `report` 做升级复判
5. 观察误判样本后，再决定是否进入 `warn / strict`
