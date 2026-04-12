import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectHostLayoutWrites } from "../lib/host-layout.js";
import { DEFAULT_RUNTIME_DIR, defaultRuntimeRelativePath } from "../lib/runtime-paths.js";

const CLI_VERSION = "0.1.2";
const RULE_MODES = new Set(["base", "full"]);
const HOSTS = new Set(["auto", "claude-code", "codex", "gemini-cli"]);
const MODES = new Set(["delivery", "explore", "poc"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ROOT = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);
const PROTOCOL_ROOT = resolveProtocolRoot();

function resolveProtocolRoot() {
  try {
    const protocolPackageJson = require.resolve("@brawnen/agent-harness-protocol/package.json");
    return path.dirname(protocolPackageJson);
  } catch {
    return path.resolve(CLI_ROOT, "../protocol");
  }
}

export function runInit(argv) {
  const parsed = parseInitArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const cwd = process.cwd();
  const project = detectProject(cwd);
  const hosts = resolveHosts(cwd, parsed.options.host);
  const actions = [];
  const warnings = [];

  queueInitActions({
    cwd,
    project,
    hosts,
    options: parsed.options,
    actions,
    warnings
  });

  printPlan(actions, parsed.options.dryRun, cwd, project, hosts);
  printWarnings(warnings);

  if (parsed.options.dryRun) {
    return 0;
  }

  for (const action of actions) {
    if (action.skip) {
      continue;
    }

    action.run();
  }

  console.log("");
  console.log("init 完成。");
  return 0;
}

function parseInitArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    host: "auto",
    mode: "delivery",
    protocolOnly: false,
    rules: "full",
    yes: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--protocol-only") {
      options.protocolOnly = true;
      continue;
    }

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--host") {
      const value = argv[index + 1];
      if (!HOSTS.has(value)) {
        return { ok: false, error: "无效的 --host 参数。可选值: auto, claude-code, codex, gemini-cli" };
      }

      options.host = value;
      index += 1;
      continue;
    }

    if (arg === "--rules") {
      const value = argv[index + 1];
      if (!RULE_MODES.has(value)) {
        return { ok: false, error: "无效的 --rules 参数。可选值: base, full" };
      }

      options.rules = value;
      index += 1;
      continue;
    }

    if (arg === "--mode") {
      const value = argv[index + 1];
      if (!MODES.has(value)) {
        return { ok: false, error: "无效的 --mode 参数。可选值: delivery, explore, poc" };
      }

      options.mode = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  return { ok: true, options };
}

function detectProject(cwd) {
  const packageJsonPath = path.join(cwd, "package.json");
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  const pnpmWorkspacePath = path.join(cwd, "pnpm-workspace.yaml");
  const goModPath = path.join(cwd, "go.mod");
  const cargoPath = path.join(cwd, "Cargo.toml");
  const pomPath = path.join(cwd, "pom.xml");
  const gradlePath = path.join(cwd, "build.gradle");
  const gradleKtsPath = path.join(cwd, "build.gradle.kts");
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  const requirementsPath = path.join(cwd, "requirements.txt");

  const packageJson = readJsonIfExists(packageJsonPath);
  const hasPackageJson = Boolean(packageJson);
  const hasTsconfig = fs.existsSync(tsconfigPath);
  const hasWorkspace = fs.existsSync(pnpmWorkspacePath) || Boolean(packageJson?.workspaces) || fs.existsSync(path.join(cwd, "packages"));
  const hasNext = existsAny(cwd, ["next.config.js", "next.config.mjs", "next.config.cjs", "next.config.ts"]);
  const hasFrontendHints = existsAny(cwd, [
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.ts",
    "src/main.ts",
    "src/main.js",
    "src/App.tsx",
    "src/App.jsx",
    "index.html"
  ]);

  let projectType = "other";
  const languages = new Set();

  if (hasWorkspace) {
    projectType = "monorepo";
  } else if (hasNext) {
    projectType = "fullstack";
  } else if (hasPackageJson && hasFrontendHints) {
    projectType = "frontend";
  } else if (hasPackageJson) {
    projectType = "library";
  } else if (fs.existsSync(goModPath) || fs.existsSync(cargoPath) || fs.existsSync(pomPath) || fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath) || fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)) {
    projectType = "backend";
  }

  if (hasPackageJson) {
    languages.add("javascript");
    languages.add("json");
  }
  if (hasTsconfig) {
    languages.add("typescript");
  }
  if (fs.existsSync(goModPath)) {
    languages.add("go");
  }
  if (fs.existsSync(cargoPath)) {
    languages.add("rust");
    languages.add("toml");
  }
  if (fs.existsSync(pomPath) || fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath)) {
    languages.add("java");
  }
  if (fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)) {
    languages.add("python");
  }
  if (languages.size === 0) {
    languages.add("markdown");
  }

  return {
    defaultCommands: inferDefaultCommands({
      packageJson,
      hasTsconfig,
      hasGo: fs.existsSync(goModPath),
      hasRust: fs.existsSync(cargoPath),
      hasMaven: fs.existsSync(pomPath),
      hasGradle: fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath),
      hasPython: fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)
    }),
    languages: [...languages],
    projectName: path.basename(cwd),
    projectType
  };
}

function inferDefaultCommands(context) {
  const commands = {};
  const scripts = context.packageJson?.scripts ?? {};

  if (scripts["type-check"]) {
    commands.type_check = "npm run type-check";
  } else if (context.hasTsconfig) {
    commands.type_check = "npx tsc --noEmit";
  }

  if (scripts.lint) {
    commands.lint = "npm run lint";
  }

  if (scripts.test) {
    commands.test = "npm test";
  } else if (context.hasGo) {
    commands.test = "go test ./...";
  }

  if (scripts.build) {
    commands.build = "npm run build";
  } else if (context.hasGo) {
    commands.build = "go build ./...";
  } else if (context.hasRust) {
    commands.build = "cargo check";
  } else if (context.hasMaven) {
    commands.build = "mvn compile";
  } else if (context.hasGradle) {
    commands.build = "./gradlew compileJava";
  } else if (context.hasPython) {
    commands.build = "python -m compileall .";
  }

  return commands;
}

function resolveHosts(cwd, explicitHost) {
  if (explicitHost !== "auto") {
    return [explicitHost];
  }

  const detected = [];
  if (fs.existsSync(path.join(cwd, "CLAUDE.md")) || fs.existsSync(path.join(cwd, ".claude"))) {
    detected.push("claude-code");
  }
  if (fs.existsSync(path.join(cwd, "AGENTS.md"))) {
    detected.push("codex");
  }
  if (fs.existsSync(path.join(cwd, "GEMINI.md"))) {
    detected.push("gemini-cli");
  }

  return detected.length > 0 ? detected : ["claude-code", "codex", "gemini-cli"];
}

function queueInitActions(context) {
  const { actions, cwd, hosts, options, project, warnings } = context;

  queueWriteAction({
    actions,
    content: renderHarnessConfig(project, options.mode),
    force: options.force,
    pathName: path.join(cwd, "harness.yaml")
  });

  queueProtocolTemplates(actions, cwd, options.force);
  queueHostLayoutActions(actions, warnings, cwd, hosts, options);

  if (!options.protocolOnly) {
    queueRuntimeFiles(actions, cwd);
  }
}

function queueHostLayoutActions(actions, warnings, cwd, hosts, options) {
  const layout = collectHostLayoutWrites(cwd, {
    hosts,
    includeConfigs: !options.protocolOnly,
    includeRules: true,
    rewrite: options.force,
    seedMissing: true
  });

  warnings.push(...layout.warnings);

  for (const write of layout.writes) {
    actions.push({
      description: describeHostLayoutWrite(write),
      relativePath: path.relative(cwd, write.targetPath),
      run: () => {
        ensureDirectory(path.dirname(write.targetPath));
        fs.writeFileSync(write.targetPath, write.content, "utf8");
      },
      skip: false
    });
  }
}

function queueProtocolTemplates(actions, cwd, force) {
  const templateDir = path.join(PROTOCOL_ROOT, "templates");
  const targetDir = path.join(cwd, DEFAULT_RUNTIME_DIR, "tasks");
  const templateFiles = fs.readdirSync(templateDir).filter((file) => file.endsWith(".md"));

  for (const file of templateFiles) {
    const source = path.join(templateDir, file);
    const target = path.join(targetDir, file);

    queueWriteAction({
      actions,
      content: readText(source),
      force,
      pathName: target
    });
  }
}

function queueRulesInjection(actions, cwd, hosts, options, ruleText) {
  const hostFiles = {
    "claude-code": "CLAUDE.md",
    codex: "AGENTS.md",
    "gemini-cli": "GEMINI.md"
  };

  for (const host of hosts) {
    const targetPath = path.join(cwd, hostFiles[host]);
    const block = buildRulesBlock(ruleText, options.rules);
    const existing = fs.existsSync(targetPath) ? readText(targetPath) : "";
    const hasMarker = containsManagedBlock(existing);
    const nextContent = buildInjectedContent(existing, block, options.force);

    actions.push({
      description: describeRuleAction(targetPath, hasMarker, options.force),
      relativePath: path.relative(cwd, targetPath),
      run: () => {
        ensureDirectory(path.dirname(targetPath));
        fs.writeFileSync(targetPath, nextContent, "utf8");
      },
      skip: hasMarker && !options.force
    });
  }
}

function queueClaudeSettingsMerge(actions, cwd) {
  const targetPath = path.join(cwd, ".claude", "settings.json");
  const templatePath = path.join(PROTOCOL_ROOT, "adapters", "claude-code", "hooks.json");
  const template = JSON.parse(readText(templatePath));
  const existing = fs.existsSync(targetPath) ? readJson(targetPath) : {};
  const merged = mergeClaudeSettings(existing, template);
  const content = `${JSON.stringify(merged, null, 2)}\n`;

  actions.push({
    description: fs.existsSync(targetPath) ? "合并 Claude Code hooks" : "创建 Claude Code hooks 配置",
    relativePath: path.relative(cwd, targetPath),
    run: () => {
      ensureDirectory(path.dirname(targetPath));
      fs.writeFileSync(targetPath, content, "utf8");
    },
    skip: false
  });
}

function queueGeminiSettingsMerge(actions, cwd) {
  const targetPath = path.join(cwd, ".gemini", "settings.json");
  const templatePath = path.join(PROTOCOL_ROOT, "adapters", "gemini-cli", "hooks.json");
  const template = JSON.parse(readText(templatePath));
  const existing = fs.existsSync(targetPath) ? readJson(targetPath) : {};
  const merged = mergeClaudeSettings(existing, template);
  const content = `${JSON.stringify(merged, null, 2)}\n`;

  actions.push({
    description: fs.existsSync(targetPath) ? "合并 Gemini CLI hooks" : "创建 Gemini CLI hooks 配置",
    relativePath: path.relative(cwd, targetPath),
    run: () => {
      ensureDirectory(path.dirname(targetPath));
      fs.writeFileSync(targetPath, content, "utf8");
    },
    skip: false
  });
}

function queueRuntimeFiles(actions, cwd) {
  const runtimeReadme = path.join(cwd, DEFAULT_RUNTIME_DIR, "README.md");
  queueWriteAction({
    actions,
    content: buildRuntimeReadme(),
    force: false,
    pathName: runtimeReadme
  });

  for (const file of [
    defaultRuntimeRelativePath("state", "tasks", ".gitkeep"),
    defaultRuntimeRelativePath("audit", ".gitkeep"),
    defaultRuntimeRelativePath("reports", ".gitkeep")
  ]) {
    const targetPath = path.join(cwd, file);
    actions.push({
      description: "创建运行时目录占位",
      relativePath: path.relative(cwd, targetPath),
      run: () => {
        ensureDirectory(path.dirname(targetPath));
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, "", "utf8");
        }
      },
      skip: false
    });
  }

  queueGitignoreUpdate(actions, cwd);
}

function queueGitignoreUpdate(actions, cwd) {
  const targetPath = path.join(cwd, ".gitignore");
  const entries = [
    "# agent-harness runtime",
    defaultRuntimeRelativePath("state") + "/",
    defaultRuntimeRelativePath("audit") + "/",
    defaultRuntimeRelativePath("reports") + "/"
  ];
  const existing = fs.existsSync(targetPath) ? readText(targetPath) : "";
  const nextContent = mergeGitignore(existing, entries);

  actions.push({
    description: fs.existsSync(targetPath) ? "更新 .gitignore" : "创建 .gitignore",
    relativePath: path.relative(cwd, targetPath),
    run: () => {
      fs.writeFileSync(targetPath, nextContent, "utf8");
    },
    skip: nextContent === existing
  });
}

function queueWriteAction({ actions, content, force, pathName }) {
  const exists = fs.existsSync(pathName);
  actions.push({
    description: exists ? (force ? "覆盖文件" : "保留现有文件") : "创建文件",
    relativePath: path.relative(process.cwd(), pathName),
    run: () => {
      ensureDirectory(path.dirname(pathName));
      if (!exists || force) {
        fs.writeFileSync(pathName, content, "utf8");
      }
    },
    skip: exists && !force
  });
}

function renderHarnessConfig(project, mode) {
  const config = {
    version: "0.3",
    project_name: path.basename(process.cwd()),
    project_type: project.projectType,
    default_mode: mode,
    allowed_paths: ["**"],
    protected_paths: [".git/**", ".idea/**"],
    default_commands: project.defaultCommands,
    risk_rules: {
      high: {
        path_matches: ["harness.yaml"],
        requires_confirmation: true,
        minimum_evidence: ["diff_summary", "manual_confirmation"],
        reason: "项目协议配置"
      },
      medium: {
        path_matches: ["CLAUDE.md", "AGENTS.md", "GEMINI.md", ".harness/**"],
        requires_confirmation: false,
        minimum_evidence: ["diff_summary"],
        reason: "宿主规则与 agent-harness 运行目录"
      },
      low: {
        path_matches: ["docs/**"],
        requires_confirmation: false,
        minimum_evidence: ["diff_summary"],
        reason: "普通文档修改"
      }
    },
    languages: project.languages,
    task_templates: {
      bug: ".harness/tasks/bug.md",
      feature: ".harness/tasks/feature.md",
      explore: ".harness/tasks/explore.md"
    },
    delivery_policy: {
      commit: {
        mode: "explicit_only",
        via: "skill",
        require: ["verify_passed", "report_generated"]
      },
      push: {
        mode: "explicit_only",
        via: "manual",
        require: ["commit_exists"]
      }
    },
    workflow_policy: {
      default_mode: "full",
      lite_allowed_if: {
        single_file: true,
        low_risk: true,
        docs_only: true,
        no_behavior_change: true,
        no_policy_change: true,
        no_output_artifacts: true
      },
      force_full_if: {
        intents: ["bug", "feature", "refactor"],
        multi_file_scope: true,
        config_changed: true,
        protocol_changed: true,
        host_adapter_changed: true,
        output_artifact_required: true,
        high_risk: true,
        override_used: true
      },
      enforcement: {
        mode: "recommend",
        upgrade_only: true
      }
    },
    output_policy: {
      report: {
        required: true,
        format: "json",
        directory: ".harness/reports",
        required_sections: [
          "task_conclusion",
          "actual_scope",
          "verification_evidence",
          "remaining_risks",
          "next_steps"
        ]
      }
    }
  };

  return `${toYaml(config)}\n`;
}

function toYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isScalar(item)) {
          return `${pad}- ${formatScalar(item)}`;
        }

        const nested = toYaml(item, indent + 1);
        const lines = nested.split("\n");
        return `${pad}- ${lines[0].trimStart()}\n${lines.slice(1).join("\n")}`;
      })
      .join("\n");
  }

  return Object.entries(value)
    .map(([key, entry]) => {
      if (isScalar(entry)) {
        return `${pad}${key}: ${formatScalar(entry)}`;
      }

      if (Array.isArray(entry) && entry.length === 0) {
        return `${pad}${key}: []`;
      }

      if (!Array.isArray(entry) && Object.keys(entry).length === 0) {
        return `${pad}${key}: {}`;
      }

      return `${pad}${key}:\n${toYaml(entry, indent + 1)}`;
    })
    .join("\n");
}

function buildRulesBlock(ruleText, rulesMode) {
  return [
    `<!-- agent-harness:start version="${CLI_VERSION}" rules="${rulesMode}" -->`,
    ruleText.trim(),
    "<!-- agent-harness:end -->",
    ""
  ].join("\n");
}

function buildInjectedContent(existing, block, force) {
  if (!existing.trim()) {
    return block;
  }

  if (!containsManagedBlock(existing)) {
    return `${existing.replace(/\s*$/, "")}\n\n${block}`;
  }

  if (!force) {
    return existing;
  }

  return existing.replace(/<!-- agent-harness:start[\s\S]*?<!-- agent-harness:end -->\n?/m, block);
}

function containsManagedBlock(content) {
  return content.includes("<!-- agent-harness:start") && content.includes("<!-- agent-harness:end -->");
}

function describeRuleAction(targetPath, hasMarker, force) {
  if (!fs.existsSync(targetPath)) {
    return "创建宿主规则文件";
  }

  if (!hasMarker) {
    return "追加宿主规则块";
  }

  return force ? "覆盖已有宿主规则块" : "保留已有宿主规则块";
}

function mergeClaudeSettings(existing, template) {
  const result = { ...existing };
  result.hooks = { ...(existing.hooks ?? {}) };

  for (const [hookName, templateEntries] of Object.entries(template.hooks ?? {})) {
    const existingEntries = Array.isArray(result.hooks[hookName]) ? [...result.hooks[hookName]] : [];
    const knownCommands = new Set(
      existingEntries.flatMap((entry) =>
        (entry.hooks ?? []).map((hook) => hook.command).filter(Boolean)
      )
    );

    for (const templateEntry of templateEntries) {
      const commands = (templateEntry.hooks ?? []).map((hook) => hook.command).filter(Boolean);
      const hasAllCommands = commands.every((command) => knownCommands.has(command));
      if (hasAllCommands) {
        continue;
      }

      existingEntries.push(templateEntry);
      for (const command of commands) {
        knownCommands.add(command);
      }
    }

    result.hooks[hookName] = existingEntries;
  }

  return result;
}

function mergeGitignore(existing, entries) {
  const trimmed = existing.replace(/\s*$/, "");
  const lines = new Set(trimmed ? trimmed.split("\n") : []);
  const missing = entries.filter((entry) => !lines.has(entry));

  if (missing.length === 0) {
    return existing;
  }

  const prefix = trimmed ? `${trimmed}\n\n` : "";
  return `${prefix}${missing.join("\n")}\n`;
}

function buildRuntimeReadme() {
  return `# agent-harness

这个目录由 \`agent-harness init\` 生成。

- \`tasks/\`：协议模板副本
- \`state/\`：后续状态持久化目录
- \`audit/\`：后续审计日志目录
- \`reports/\`：后续任务报告目录
`;
}

function printPlan(actions, dryRun, cwd, project, hosts) {
  console.log(`project: ${project.projectName}`);
  console.log(`project_type: ${project.projectType}`);
  console.log(`hosts: ${hosts.join(", ")}`);
  console.log(`target_dir: ${cwd}`);
  console.log("");
  console.log(dryRun ? "计划写入：" : "执行写入：");

  for (const action of actions) {
    const prefix = action.skip ? "[skip]" : dryRun ? "[dry-run]" : "[write]";
    console.log(`${prefix} ${action.description}: ${action.relativePath}`);
  }
}

function printWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) {
    return;
  }

  console.log("");
  console.log("提示：");
  for (const warning of warnings) {
    console.log(`  - ${warning}`);
  }
}

function describeHostLayoutWrite(write) {
  if (write.type === "source") {
    return "写入收敛布局源文件";
  }

  if (write.type === "host") {
    return "生成宿主薄壳配置";
  }

  if (write.type === "rule") {
    return "生成宿主规则文件";
  }

  if (write.type === "generated") {
    return "生成布局清单";
  }

  return "写入布局文件";
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function existsAny(cwd, names) {
  return names.some((name) => fs.existsSync(path.join(cwd, name)));
}

function isScalar(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatScalar(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}
