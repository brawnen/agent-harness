# Task Core 误判样本记录流程 v0.1

## 目标

为 `packages/cli/src/lib/task-core.js` 的 `continue / new / clarify` 判定建立统一的误判记录与修复流程，避免后续维护时直接拍脑袋加规则。

核心原则只有一条：

**先补 fixture，再改规则。**

## 适用范围

适用于以下情况：

- Codex 自动 intake 把 follow-up 误判成新任务
- Codex 自动 intake 把新任务误判成当前任务续写
- 本应 `clarify` 的输入被直接归类为 `continue` 或 `new`
- 高风险且归属不明的输入未被 block
- 当前分类 `reason_code` 明显不符合预期

## 最小记录字段

每次发现真实误判时，至少记录以下信息：

1. `active_task`
   - 当前活跃任务的 `goal`
   - 当前活跃任务的 `scope`
   - 当前活跃任务的 `current_state`

2. `prompt`
   - 用户原始输入，不要自行润色

3. `actual`
   - 当前实际输出的 `action`
   - 当前实际输出的 `decision.type`
   - 当前实际输出的 `decision.reason_code`
   - 当前实际输出的 `block`

4. `expected`
   - 你认为正确的 `action`
   - 你认为正确的 `decision_type`
   - 你认为正确的 `reason_code`
   - 你认为正确的 `block`

5. `why_misclassified`
   - 一句话说明为什么这是误判

## 标准处理流程

### 1. 先确认这是“可复现的误判”

不要因为一次主观不满意就改规则。先确认：

- 当前样本能稳定复现
- 误判不是由 task state 本身异常引起
- 误判不是由用户输入本身高度模糊但本就应该 `clarify`

### 2. 先补到 fixture

把样本补到：

- [task-core-classification.json](/Users/lijianfeng/code/pp/agent-harness/packages/cli/fixtures/task-core-classification.json)

写法要求：

- `name` 用短标签，表达场景而不是结论
- `prompt` 保留原始语义
- `active_task` 只保留最小复现所需字段
- `expected` 写成你希望系统输出的稳定结果

### 3. 先跑回归

执行：

```bash
npm --prefix packages/cli run verify:task-core
```

此时应出现：

- 新加样本失败
- 其他旧样本仍通过

如果新样本一开始就通过，说明它不是误判样本，不需要改规则。

### 4. 再决定是否改规则

只有在 fixture 已经明确失败后，才允许改：

- [task-core.js](/Users/lijianfeng/code/pp/agent-harness/packages/cli/src/lib/task-core.js)

修改目标是：

- 让新增样本通过
- 不打破已有样本
- 尽量复用现有 `reason_code`

### 5. 回归通过后再合并

规则改完后必须重新执行：

```bash
npm --prefix packages/cli run verify:task-core
```

只有全部通过，才说明本次修复成立。

## 明确禁止

以下做法禁止：

- 没有补 fixture 就直接改 `task-core`
- 为了一个单点样本引入大段复杂打分逻辑
- 通过修改 fixture 来“迎合”当前错误行为
- 把高度歧义输入强行判成 `continue` 或 `new`，而不是 `clarify`
- 为了提高自动化比例而降低高风险输入的保守性

## 什么时候不该改规则

以下情况优先观测，不急着改：

- 只有一次偶发误判，还没看到同类样本重复出现
- 输入本身极短、极模糊，本来就应该落到 `clarify`
- 当前问题更像是宿主上下文缺失，而不是 `task-core` 分类问题

## 推荐提交粒度

如果后续真的要修误判，建议一次提交只做：

1. 一个或一组同类 fixture
2. 一次对应的最小规则修正

不要把多个不同类型误判混在一次改动里，否则很难判断是哪条规则带来的回归。

## 当前样本入口

- 样本集：
  [task-core-classification.json](/Users/lijianfeng/code/pp/agent-harness/packages/cli/fixtures/task-core-classification.json)
- 回归脚本：
  [verify-task-core-classification.js](/Users/lijianfeng/code/pp/agent-harness/packages/cli/scripts/verify-task-core-classification.js)
