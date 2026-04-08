# Host 目录收敛重构方案

> 日期：2026-04-07
> 状态：提案
> 目标读者：项目维护者 / 执行 agent

---

## 1. 问题定义

当前项目在仓库根目录同时存在：

- `.harness/`
- `.codex/`
- `.claude/`
- `.gemini/`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`

从接入者视角，这套结构的问题不是“文件太多”本身，而是：

1. 真实逻辑分散
2. 哪些文件是宿主强制要求、哪些文件是我们自己的实现边界，不直观
3. 多宿主接入时，用户会误以为需要分别维护四套配置
4. `init / status / docs / runtime` 目前围绕“宿主目录 + 运行时目录”混合展开，不够收敛

---

## 2. 收敛结论

结论不是“把所有目录物理合并成一个目录”，而是：

- 把 `.harness/` 升级为唯一真实控制面
- 把 `.codex/.claude/.gemini` 降级为宿主发现入口
- 把 `AGENTS.md / CLAUDE.md / GEMINI.md` 改成由共享源生成

换句话说：

- **真实实现单源化**
- **宿主入口薄壳化**
- **规则文本模板化**

---

## 3. 为什么不能彻底删掉宿主目录

这几个目录里，至少一部分是宿主的项目级发现约定，不是我们能自由替换的：

- `Codex` 读取 `.codex/config.toml` 与 `.codex/hooks.json`
- `Claude Code` 读取 `.claude/settings.json`
- `Gemini CLI` 读取 `.gemini/settings.json`
- 三端规则注入文件名也受宿主约定影响：`AGENTS.md / CLAUDE.md / GEMINI.md`

因此：

- 可以收敛实现位置
- 不能假设宿主会改为直接读取 `.harness/`

所以本方案不追求“只剩 `.harness/`”，而追求“只有 `.harness/` 需要维护”。

---

## 4. 目标目录布局

### 4.1 仓库根保留的宿主入口

这些文件仍然保留在根目录，但只承担“宿主发现入口”角色：

```text
.codex/
.claude/
.gemini/
AGENTS.md
CLAUDE.md
GEMINI.md
```

### 4.2 `.harness/` 作为唯一真实源

目标结构：

```text
.harness/
  tasks/
  state/
  audit/
  reports/
  hosts/
    codex/
      hooks/
      hooks.json.tmpl
      config.toml.tmpl
    claude/
      settings.json.tmpl
    gemini/
      settings.json.tmpl
  rules/
    shared.md
    codex.md
    claude.md
    gemini.md
  generated/
    manifest.json
```

含义：

- `tasks/state/audit/reports`：现有运行时目录，继续保留
- `hosts/*`：宿主模板与薄壳生成源
- `rules/*`：共享规则与宿主增量规则
- `generated/manifest.json`：记录生成结果、源文件版本和上次 sync 时间

---

## 5. 目标职责分层

### 5.1 `.harness/hosts/*`

职责：

- 保存宿主模板
- 保存 repo-local wrapper 真正实现
- 为根目录宿主入口生成产物提供源文件

不再把真实 hook 实现散落在根目录宿主文件夹里。

### 5.2 根目录宿主目录

职责：

- 满足宿主发现机制
- 只保留最薄一层配置/转发文件

例如：

- `.codex/hooks.json` 指向 `.harness/hosts/codex/...`
- `.claude/settings.json` 由 `.harness/hosts/claude/settings.json.tmpl` 生成
- `.gemini/settings.json` 由 `.harness/hosts/gemini/settings.json.tmpl` 生成

### 5.3 `.harness/rules/*`

职责：

- `shared.md`：三端共用规则正文
- `codex.md / claude.md / gemini.md`：宿主差异附加块

最终生成：

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`

---

## 6. 生成策略

新增命令：

```bash
agent-harness sync
agent-harness sync --check
agent-harness sync --rewrite
```

### 6.1 `sync` 的职责

1. 从 `.harness/hosts/*` 生成根目录宿主配置
2. 从 `.harness/rules/*` 生成三份宿主规则文件
3. 写入 `.harness/generated/manifest.json`
4. 校验生成结果是否仍指向 `.harness`

### 6.2 `--check`

只做校验，不写文件。用于：

- CI
- `status`
- 发布前检查

### 6.3 `--rewrite`

覆盖重写生成物，用于：

- 模板升级
- 宿主配置收敛
- 仓库内一次性迁移

---

## 7. 迁移目标

### 7.1 Phase 1：先引入单一真实源

做法：

- 新增 `.harness/hosts/*`
- 新增 `.harness/rules/*`
- 保持现有 `.codex/.claude/.gemini` 继续工作

目标：

- 不改变用户当前可用性
- 先建立未来收敛所需的源目录

### 7.2 Phase 2：增加生成器

做法：

- 新增 `agent-harness sync`
- `init` 默认写 `.harness` 源文件，再生成宿主薄壳
- `status` 同时识别旧布局和新布局

目标：

- 新仓库默认走收敛布局
- 老仓库继续兼容

### 7.3 Phase 3：迁移当前仓库

做法：

- 把 `.codex/hooks/*.js` 迁入 `.harness/hosts/codex/hooks/`
- 把宿主规则从手工维护切到模板生成
- 根目录宿主文件只保留生成产物

目标：

- 当前仓库成为新布局参考实现

### 7.4 Phase 4：弃用旧布局

做法：

- 文档默认只讲新布局
- `status` 对旧布局输出 deprecation 提示
- `init` 不再优先生成旧分散结构

目标：

- 把“分散目录”从默认形态降为兼容形态

---

## 8. 对现有代码的影响

### 8.1 必改模块

- `packages/cli/src/commands/init.js`
- `packages/cli/src/commands/status.js`
- `packages/cli/src/lib/runtime-paths.js`
- `packages/cli/src/lib/workflow-policy.js`
- `packages/protocol/adapters/*`

### 8.2 需要迁移的根目录资产

- `.codex/hooks/`
- `.codex/hooks.json`
- `.codex/config.toml`
- `.claude/settings.json`
- `.gemini/settings.json`
- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`

### 8.3 现有运行时目录

这些目录不迁：

- `.harness/tasks/`
- `.harness/state/`
- `.harness/audit/`
- `.harness/reports/`

原因：

- 它们已经是正确的运行时聚合层
- 本轮要收敛的是宿主接入层，不是运行时状态层

---

## 9. 兼容策略

### 9.1 旧仓库兼容

`status` 与 `init` 必须同时兼容：

- 旧布局：根目录真实维护 `.codex/.claude/.gemini`
- 新布局：`.harness` 为真实源，根目录宿主文件为薄壳

### 9.2 宿主兼容

根目录宿主入口文件继续保留，避免：

- Codex trusted project 配置失效
- Claude Code 找不到 `.claude/settings.json`
- Gemini CLI 找不到 `.gemini/settings.json`

### 9.3 文档兼容

README 迁移策略：

- 先说明“为什么仍能看到 `.codex/.claude/.gemini`”
- 再说明“真正需要维护的是 `.harness`”

避免让用户以为“仍然要维护四套目录”。

---

## 10. 非目标

本轮不做：

- 把宿主目录彻底删除
- 引入 `.ai/` 之类全新顶层目录并要求宿主直接读取
- 用软链接代替生成器作为默认方案
- 重写当前 hook core / host io adapter 架构

---

## 11. 主要风险

### 11.1 生成物漂移

如果根目录薄壳仍允许手改，而 `.harness` 又是单一真实源，会出现双写问题。

应对：

- 明确 generated 文件头注释
- `sync --check` 检测漂移

### 11.2 旧布局与新布局并存导致判断复杂

`status / init / sync` 三者如果判断标准不一致，会放大用户困惑。

应对：

- 统一引入“布局检测器”
- 所有命令共用同一套布局判定逻辑

### 11.3 规则文件的宿主差异被过度抽象

三端规则并不完全相同，不能强行只保留 `shared.md`。

应对：

- 保留 `shared.md + host delta` 结构
- 不追求单文件包打天下

---

## 12. 推荐执行顺序

1. 新增 `.harness/hosts/*` 与 `.harness/rules/*`
2. 新增 `agent-harness sync`
3. 让 `init` 写源文件并生成薄壳
4. 让 `status` 同时识别新旧布局
5. 迁移当前仓库的 Codex 实现
6. 迁移 Claude / Gemini 配置模板
7. 最后统一 README 与使用指南

---

## 13. 最终判断

最现实、也最产品化的方向不是“彻底消灭宿主目录”，而是：

> 让 `.harness` 成为唯一真实实现层，让 `.codex/.claude/.gemini` 退化成宿主薄壳。

这样可以同时满足：

- 宿主发现约定
- 项目内部结构收敛
- 用户只维护一套真实源
- 后续多宿主接入扩展更可控
