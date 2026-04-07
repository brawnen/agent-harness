import fs from "node:fs";
import path from "node:path";

export const DEFAULT_RUNTIME_DIR = ".harness";
export const LEGACY_RUNTIME_DIR = "harness";

const STRONG_PROJECT_ROOT_MARKERS = [
  "harness.yaml",
  ".codex/hooks.json",
  ".claude/settings.json",
  ".gemini/settings.json"
];

export function resolveRuntimeDirName(cwd, options = {}) {
  const preferExisting = options.preferExisting !== false;
  if (preferExisting) {
    if (fs.existsSync(path.join(cwd, DEFAULT_RUNTIME_DIR))) {
      return DEFAULT_RUNTIME_DIR;
    }
    if (fs.existsSync(path.join(cwd, LEGACY_RUNTIME_DIR))) {
      return LEGACY_RUNTIME_DIR;
    }
  }
  return DEFAULT_RUNTIME_DIR;
}

export function resolveHarnessProjectRoot(cwd) {
  const fallback = path.resolve(cwd || process.cwd());
  let current = fallback;
  let bestCandidate = null;

  while (true) {
    const score = getProjectRootScore(current);
    if (score > 0 && (!bestCandidate || score > bestCandidate.score)) {
      bestCandidate = { path: current, score };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return bestCandidate?.path ?? fallback;
    }

    current = parent;
  }
}

export function runtimePath(cwd, ...segments) {
  return path.join(cwd, resolveRuntimeDirName(cwd), ...segments);
}

export function defaultRuntimeRelativePath(...segments) {
  return path.posix.join(DEFAULT_RUNTIME_DIR, ...segments);
}

export function legacyRuntimeRelativePath(...segments) {
  return path.posix.join(LEGACY_RUNTIME_DIR, ...segments);
}

export function runtimeRelativePathForCwd(cwd, ...segments) {
  const runtimeDir = resolveRuntimeDirName(cwd);
  return path.posix.join(runtimeDir, ...segments);
}

export function runtimeRelativeCandidates(...segments) {
  return [
    defaultRuntimeRelativePath(...segments),
    legacyRuntimeRelativePath(...segments)
  ];
}

export function hasRuntimeSetup(cwd) {
  return runtimeRelativeCandidates().some((relativePath) => fs.existsSync(path.join(cwd, relativePath)));
}

function getProjectRootScore(cwd) {
  if (STRONG_PROJECT_ROOT_MARKERS.some((relativePath) => fs.existsSync(path.join(cwd, relativePath)))) {
    return 2;
  }

  if (fs.existsSync(path.join(cwd, DEFAULT_RUNTIME_DIR)) || fs.existsSync(path.join(cwd, LEGACY_RUNTIME_DIR))) {
    return 1;
  }

  return 0;
}
