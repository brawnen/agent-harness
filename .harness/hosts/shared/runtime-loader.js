import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

const RUNTIME_MODULES = {
  "runtime-host": {
    monorepoPath: ["packages", "cli", "src", "runtime-host", "index.js"],
    packageFilePath: ["node_modules", "@brawnen", "agent-harness-cli", "src", "runtime-host", "index.js"],
    packageSpecifier: "@brawnen/agent-harness-cli/runtime-host"
  }
};

export async function importRuntimeModule(moduleName, cwd = process.cwd()) {
  const definition = RUNTIME_MODULES[String(moduleName ?? "").trim()];
  if (!definition) {
    throw new Error(`未知 runtime 模块：${moduleName}`);
  }

  const repoRoot = resolveRepoRoot(cwd);
  const candidates = [
    path.join(repoRoot, ...definition.monorepoPath),
    path.join(repoRoot, ...definition.packageFilePath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  try {
    const resolved = require.resolve(definition.packageSpecifier, {
      paths: [repoRoot]
    });
    return import(pathToFileURL(resolved).href);
  } catch {
    throw new Error(
      `无法解析 agent-harness runtime 模块：${moduleName}。请确认目标仓库已安装 @brawnen/agent-harness-cli，或当前在 agent-harness monorepo 内执行。`
    );
  }
}

export async function importCliModule(moduleRelativePath, cwd = process.cwd()) {
  const repoRoot = resolveRepoRoot(cwd);
  const normalizedPath = String(moduleRelativePath ?? "").replace(/^[/\\]+/, "");
  const candidates = [
    path.join(repoRoot, "packages", "cli", normalizedPath),
    path.join(repoRoot, "node_modules", "@brawnen", "agent-harness-cli", normalizedPath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }

  try {
    const resolved = require.resolve(`@brawnen/agent-harness-cli/${toPosixPath(normalizedPath)}`, {
      paths: [repoRoot]
    });
    return import(pathToFileURL(resolved).href);
  } catch {
    throw new Error(
      `无法解析 agent-harness runtime 模块：${normalizedPath}。请确认目标仓库已安装 @brawnen/agent-harness-cli，或当前在 agent-harness monorepo 内执行。`
    );
  }
}

function resolveRepoRoot(cwd) {
  let current = path.resolve(cwd);

  while (true) {
    if (
      fs.existsSync(path.join(current, "harness.yaml")) ||
      fs.existsSync(path.join(current, ".harness")) ||
      fs.existsSync(path.join(current, ".git"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(cwd);
    }
    current = parent;
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}
