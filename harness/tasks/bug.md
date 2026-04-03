---
template_id: bug
intent: bug
goal: "<必填：一句话描述要修复的问题>"
scope:
  - "<必填：允许修改的模块、目录或文件>"
acceptance:
  - "<必填：什么算修复完成>"
title: "<可选：任务标题>"
constraints:
  - "<可选：不能做什么>"
verification:
  - "<可选：验证命令或人工验证步骤>"
context_refs:
  - "<可选：日志、报错、相关设计文档>"
mode: delivery
risk_level: "<派生：由 harness 和 project config 推导>"
evidence_required: []
---

# Bug 任务模板

## 现象

- 用户可见问题：
- 触发条件：
- 预期行为：

## 已知事实

- 已确认边界：
- 已知不允许修改的部分：
- 相关上下文：

## 根因假设

- 假设 1：
- 假设 2：
- 仍待确认的问题：

## 执行计划

- 最小修复路径：
- 不做的改动：
- 回滚方式：

## 验证记录

- 执行命令：
- 结果摘要：
- 缺失证据：

## 输出结论

- 根因判断：
- 实际改动范围：
- 剩余风险：
- 下一步建议：
