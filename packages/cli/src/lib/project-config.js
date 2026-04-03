import fs from "node:fs";
import path from "node:path";

export function loadProjectConfig(cwd) {
  const configPath = path.join(cwd, "harness.yaml");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf8");
  return {
    allowed_paths: readStringList(content, "allowed_paths"),
    default_mode: readScalar(content, "default_mode"),
    path: configPath,
    project_type: readScalar(content, "project_type"),
    protected_paths: readStringList(content, "protected_paths")
  };
}

function readScalar(content, key) {
  const match = content.match(new RegExp(`^${escapeRegExp(key)}:\\s+"?([^"\\n]+)"?\\s*$`, "m"));
  return match?.[1] ?? null;
}

function readStringList(content, key) {
  const lines = content.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === `${key}:`);
  if (startIndex < 0) {
    return [];
  }

  const values = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("  - ")) {
      break;
    }

    values.push(unquote(line.slice(4).trim()));
  }

  return values;
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
