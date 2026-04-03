# Harness 部署规范 v0.1

> 状态：已被新的开源架构方案部分取代。
>
> 当前仓库已确认对外名称为 `agent-harness`，开源分层、npm 分发、Node.js CLI 与 `init` MVP 边界以
> [2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md](./2026-04-02-agent-harness-open-source-architecture-adr-v0.1.md)
> 为准。
>
> 本文保留的价值主要是：
>
> - 记录早期“项目内嵌 / Ruby 全局安装”思路
> - 为后续迁移 `state / gate / verify / report` 提供参考
>
> 本文以下内容不再作为开源默认方案：
>
> - `install.rb` 作为主安装路径
> - Ruby 作为开源主 CLI 语言
> - 协议层与 CLI 层绑定发布

## 1. 背景与问题

### 1.1 当前状态

Harness v0.2 已完成核心引擎实现：CLI（intake / state / gate / verify / report）、L1 hooks、L2 行为规则、7 个 JSON Schema。但所有这些都以"嵌入项目"的方式存在——bin/ 和 lib/ 目录直接放在项目仓库里，没有全局安装路径，也没有一键部署到其他项目的能力。

### 1.2 根本缺口

当前隐含前提：

> Harness 和业务代码住在同一个仓库里。

正确的架构前提：

> Harness 是一个独立的全局工具，可以被任意项目以最小代价接入，不污染业务代码。

### 1.3 影响

- 每次想在新项目使用 harness，都需要手动复制 bin/ lib/ harness.yaml CLAUDE.md 片段
- 复制的版本无法自动更新
- 业务仓库因此多了与业务无关的工具代码
- 与"agent native，项目只感知配置，不感知工具实现"的目标背离

---

## 2. 设计目标

### 2.1 核心目标

1. **一次安装**：Harness CLI 全局安装，只装一次，所有项目共用
2. **一条命令接入**：在任意项目目录执行 `harness init`，完成所有接入动作
3. **非侵入**：只写指定配置文件，完全不接触业务代码
4. **可更新**：`harness update` 可在不破坏用户内容的前提下同步最新规则
5. **可检查**：`harness status` 随时输出当前项目接入状态和健康度

### 2.2 非目标

- 不发布到任何公开包管理器（当前阶段）
- 不需要网络连接才能运行
- 不修改业务代码目录下的任何源文件

---

## 3. 总体架构

```
~/.harness/                    ← 全局安装目录（只装一次）
  bin/
    harness                    ← 全局入口，加入 PATH
  lib/
    harness_cli.rb
    harness_cli/
      config.rb
      intake.rb
      state.rb
      gate.rb
      verify.rb
      report.rb
      audit.rb
      init.rb                  ← 新增：项目初始化
      status.rb                ← 新增：状态检查
      updater.rb               ← 新增：规则更新
  core/
    rules/
      base-rules.md            ← L2 规则精简版（约 30 行）
      full-rules.md            ← L2 规则完整版（约 100 行）
    schemas/                   ← JSON Schema 文件（同当前）
    tasks/
      bug.md
      feature.md
      explore.md
  install.rb                   ← 全局安装脚本

<任意项目>/                     ← 目标项目，业务代码完全不变
  harness.yaml                 ← 唯一必须存在的项目配置
  CLAUDE.md                    ← 自动注入 harness 规则块
  AGENTS.md                    ← 同上（Codex）
  GEMINI.md                    ← 同上（Gemini CLI）
  .claude/
    settings.json              ← 注入 PreToolUse/PostToolUse hooks
  .gitignore                   ← 自动追加 harness 运行时目录
  harness/                     ← 运行时数据（不进业务仓库）
    state/
    audit/
    reports/
```

**关键设计决策**：hooks 中的命令指向全局安装路径（`~/.harness/bin/harness`），而不是项目内路径。业务仓库不需要任何 harness 的 Ruby 代码。

---

## 4. 全局安装

### 4.1 安装方式

第一版采用本地脚本安装（`install.rb`），不依赖 gem 发布流程。

```bash
# 从 harness 项目目录执行
ruby install.rb

# 或指定安装目录
ruby install.rb --prefix ~/.local
```

### 4.2 安装脚本行为

1. 将 `~/.harness/` 作为默认安装目录（可通过 `--prefix` 覆盖）
2. 复制 bin/ lib/ core/ 到安装目录
3. 在 `~/.harness/bin/harness` 写入版本信息
4. 检测 shell（zsh / bash），在 `~/.zshrc` 或 `~/.bashrc` 追加 PATH 配置
5. 验证安装：运行 `harness --version`，输出版本号

### 4.3 安装后结构

```
~/.harness/
  VERSION              ← 当前版本号（如 "0.2.0"）
  bin/harness          ← 全局入口
  lib/...
  core/...
  install.rb           ← 保留，用于后续升级
```

### 4.4 升级

```bash
# 从新版 harness 项目目录执行
ruby install.rb --upgrade
```

升级脚本只替换 lib/ 和 core/，不修改已接入项目的 harness.yaml。

---

## 5. harness init

### 5.1 触发方式

```bash
cd /path/to/my-project
harness init
```

可选参数：

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--mode` | 默认工作模式 | `delivery` |
| `--rules` | 规则注入粒度：`base` / `full` | `full` |
| `--dry-run` | 只输出将要执行的动作，不实际写文件 | `false` |
| `--force` | 已有 harness.yaml 时强制覆盖 | `false` |

### 5.2 执行步骤

#### Step 1：检测项目类型

根据以下文件推断技术栈，用于填充 `default_commands`：

| 检测文件 | 推断类型 | 默认验证命令 |
|---|---|---|
| `package.json` + `tsconfig.json` | TypeScript / Node | `npm run type-check` / `npm test` |
| `package.json` | JavaScript / Node | `npm test` |
| `pom.xml` | Java (Maven) | `mvn compile` |
| `build.gradle` / `build.gradle.kts` | Java (Gradle) | `./gradlew compileJava` |
| `go.mod` | Go | `go build ./...` |
| `Gemfile` | Ruby | `bundle exec rspec` |
| `requirements.txt` / `pyproject.toml` | Python | `flake8` |
| `Cargo.toml` | Rust | `cargo check` |
| 无法识别 | generic | _(留空，用户填写)_ |

#### Step 2：生成 harness.yaml

基于检测结果，在项目根目录生成 `harness.yaml`。若文件已存在，询问用户是否覆盖（`--force` 跳过询问）。

生成规则：
- `project_name`：读取项目目录名
- `project_type`：由检测结果填入
- `languages`：由检测结果填入
- `default_mode`：由 `--mode` 参数决定
- `allowed_paths`：默认 `["**"]`（宽松），用户后续收紧
- `protected_paths`：默认 `[".idea/**", ".git/**"]`
- `default_commands`：由检测结果填入
- `risk_rules`：内置保守默认值

#### Step 3：注入 CLAUDE.md / AGENTS.md / GEMINI.md

使用 marker 保护，允许与用户已有内容共存：

```markdown
（用户原有内容，完全不动）

<!-- harness:start version="0.2" -->
# Harness 任务收敛规则
...（规则内容）...
<!-- harness:end -->
```

行为规则：
- 文件不存在 → 创建，直接写入规则块
- 文件存在且无 marker → 追加到文件末尾
- 文件存在且有 marker → 不动（`harness update` 才会更新）
- 文件存在且有 marker 但版本旧 → 警告，建议运行 `harness update`

#### Step 4：合并 .claude/settings.json

只写入 hooks 相关配置，其他字段完全保留：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "FILE_PATH=$(echo \"$TOOL_INPUT\" | ruby -rjson -e 'puts JSON.parse(STDIN.read).values_at(\"file_path\",\"path\").compact.first rescue nil' 2>/dev/null); ~/.harness/bin/harness gate before-tool --tool \"$TOOL_NAME\" ${FILE_PATH:+--file-path \"$FILE_PATH\"}"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.harness/bin/harness state update --tool \"$TOOL_NAME\" --exit-code \"$EXIT_CODE\""
          }
        ]
      }
    ]
  }
}
```

合并规则：
- 文件不存在 → 创建，只写 hooks
- 文件存在 → 深度合并，不覆盖已有 key
- PreToolUse / PostToolUse 已有条目 → 检查是否已有 harness 条目，避免重复写入

#### Step 5：更新 .gitignore

检查是否已有以下条目，没有则追加：

```
# Harness 运行时产物
harness/state/
harness/audit/
```

#### Step 6：创建运行时目录占位

```
harness/state/tasks/.gitkeep
harness/audit/.gitkeep
harness/reports/.gitkeep
```

#### Step 7：输出接入摘要

```
✅ harness init 完成

项目：my-project（TypeScript / Node）
接入模式：delivery（L1 + L2）

已完成：
  ✓ harness.yaml 已生成
  ✓ CLAUDE.md 已注入规则块（full）
  ✓ AGENTS.md 已注入规则块（full）
  ✓ GEMINI.md 已注入规则块（full）
  ✓ .claude/settings.json hooks 已合并
  ✓ .gitignore 已更新

下一步：
  - 检查 harness.yaml，按需收紧 allowed_paths 和 risk_rules
  - 重启 Claude Code 以激活 hooks
  - 开始任务：直接自然语言描述即可，harness 会自动收敛
```

---

## 6. harness status

### 6.1 触发方式

```bash
harness status
```

### 6.2 输出内容

检查当前项目的接入完整性和运行时状态：

```
harness status — my-project

接入检查：
  [✓] harness.yaml          version: 0.2, mode: delivery
  [✓] CLAUDE.md             harness 规则块存在（v0.2）
  [✓] AGENTS.md             harness 规则块存在（v0.2）
  [✓] GEMINI.md             harness 规则块存在（v0.2）
  [✓] .claude/settings.json hooks 已配置
  [✓] .gitignore            harness/state/ harness/audit/ 已排除
  [✓] ~/.harness/           v0.2.0 已安装

运行时状态：
  活跃任务：bug-login-fix-a3f2 （in_progress，execute 阶段）
  挂起任务：feature-upload-7b1c （suspended）
  已完成：3 个任务，最近：2026-04-02

警告：
  [!] GEMINI.md 规则块版本为 v0.1，建议运行 harness update
```

### 6.3 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 接入完整，无警告 |
| 1 | 有警告（版本旧、部分文件缺失） |
| 2 | 接入不完整（harness.yaml 不存在或 hooks 未配置） |

---

## 7. harness update

### 7.1 触发方式

```bash
harness update
```

### 7.2 行为

只更新 CLAUDE.md / AGENTS.md / GEMINI.md 中的 harness 规则块（marker 之间的内容），其他内容完全不动。

```
harness update — my-project

更新规则块：
  ✓ CLAUDE.md    v0.1 → v0.2（+12 行）
  ✓ AGENTS.md    v0.1 → v0.2（+12 行）
  - GEMINI.md    v0.2 已是最新，跳过

hooks 检查：
  ✓ .claude/settings.json 已是最新

完成。
```

`update` 不重新生成 `harness.yaml`（用户可能已自定义）。

---

## 8. 非侵入性保障

| 文件 | 操作方式 | 保障 |
|---|---|---|
| `harness.yaml` | 仅 init 时生成，已存在则不覆盖 | 用户自定义不被破坏 |
| `CLAUDE.md` 等 | marker 保护的局部注入 | marker 外的用户内容完全不变 |
| `.claude/settings.json` | 深度 merge，不覆盖已有 key | 已有 permissions / other 配置不丢失 |
| `.gitignore` | 追加，不删除已有条目 | 已有忽略规则不变 |
| 业务源代码 | 完全不接触 | 无任何业务代码被修改 |
| `harness/` 运行时目录 | .gitignore 排除 | 不进入业务仓库 |

---

## 9. 版本兼容策略

### 9.1 harness.yaml 版本

`harness.yaml` 头部的 `version` 字段标记配置 schema 版本。

- 当前版本：`0.2`
- 低版本配置：harness 以兼容模式运行，并提示升级
- 字段缺失：使用内置默认值，不报错

### 9.2 规则块版本

CLAUDE.md 等文件中的 marker 携带版本号：

```
<!-- harness:start version="0.2" -->
```

- `harness status` 检测并提示旧版本
- `harness update` 按版本号决定是否更新

### 9.3 CLI 二进制版本

`~/.harness/VERSION` 记录当前安装版本。

- `harness --version` 输出版本号
- `harness init` 将安装版本写入 harness.yaml 的 `harness_version` 字段

---

## 10. 开放决策（待确认）

### D1：全局安装机制

| 选项 | 方式 | 适用场景 |
|---|---|---|
| A | `install.rb` 脚本 + 手动加 PATH | 最简单，当前阶段推荐 |
| B | Ruby gem（`gem install harness`） | 更标准，需要 gem 发布 |
| C | Shell one-liner（`curl ... \| bash`） | 最便捷，需要托管脚本 |

**建议**：第一版选 A，后续可升级到 B 或 C。

### D2：init 时规则注入粒度

| 选项 | 内容 | 行数 |
|---|---|---|
| `base` | intake + 执行门禁 + 完成门禁（最关键的三块） | ~30 行 |
| `full` | 完整 CLAUDE.md 规则（含 observe / override / 多任务 / state 持久化） | ~100 行 |
| `interactive` | init 时询问用户 | — |

**建议**：默认 `full`，`--rules base` 提供精简选项。

### D3：harness.yaml 与业务仓库的关系

| 选项 | 含义 |
|---|---|
| A | harness.yaml 进入业务仓库（推荐：团队共享配置） |
| B | harness.yaml 加入 .gitignore（个人本地配置） |

**建议**：默认进仓库（类似 .eslintrc），因为它描述的是项目级协作规则。

---

## 11. 与现有设计的关系

本文档是对 v0.2 主设计说明书 §19（推荐实现路径）的补充和具体化。

v0.2 §19 定义了 Phase 1-4 的产出目标，但未涉及"如何把 harness 部署到其他项目"这个问题。本文档将这个能力定位为 **Phase 2 的收尾工作**，是 Phase 2 → Phase 3 的过渡桥梁：

- Phase 2 产出了 CLI 引擎（已完成）
- 本文档描述如何把 CLI 引擎变成可被任意项目使用的全局工具
- Phase 3 在此基础上实现更完整的 Host Adapter 抽象

---

## 12. 实现 TODO

按优先级排序：

1. `~/.harness/` 安装目录结构 + `install.rb`
2. `harness init`（核心，含项目类型检测 + 七步接入）
3. `harness status`（接入健康检查）
4. `harness update`（规则块版本升级）
5. 调整现有 hooks 命令，使用 `~/.harness/bin/harness` 而非 `ruby bin/harness`
