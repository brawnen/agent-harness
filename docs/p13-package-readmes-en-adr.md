# ADR: 新增 packages/cli 和 packages/protocol 的英文 README，补齐包级开源入口说明

## 状态

Proposed

## 背景

- task_id: `p13-package-readmes-en`
- intent: `feature`
- risk_level: `low`
- goal: 新增 packages/cli 和 packages/protocol 的英文 README，补齐包级开源入口说明

## 决策

- 将双语开源入口从根 README 下沉到包目录：
  - 为 `packages/cli` 新增 `README.en.md`
  - 为 `packages/protocol` 新增 `README.en.md`
- 保持根 README、包 README、以及未来发布形态之间的术语一致，但不把包 README 扩写成完整设计文档。
- 明确把“英文包说明”视为开源可读性的一部分，而不是临时翻译工作。

## 后果

- 正面影响：
  - 英文开发者进入包目录时不再只能看到中文说明
  - `protocol` 和 `cli` 的边界更容易被外部贡献者理解
  - 包级说明与根 README 的开源首页形成更完整的双语入口
- 代价与风险：
  - 后续需要同步维护中英文包 README
  - 若根 README、中文包 README、英文包 README 的事实边界不一致，会增加认知成本

## 影响范围

- packages/cli/README.en.md
- packages/protocol/README.en.md
- CHANGELOG.md
