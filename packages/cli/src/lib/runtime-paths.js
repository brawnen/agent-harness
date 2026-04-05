import fs from "node:fs";
import path from "node:path";

export const DEFAULT_RUNTIME_DIR = ".harness";
export const LEGACY_RUNTIME_DIR = "harness";

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
