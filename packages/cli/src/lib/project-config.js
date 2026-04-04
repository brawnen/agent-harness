import fs from "node:fs";
import path from "node:path";

export function loadProjectConfig(cwd) {
  const configPath = path.join(cwd, "harness.yaml");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf8");
  const parsed = parseSimpleYaml(content);

  return {
    allowed_paths: normalizeStringArray(parsed.allowed_paths),
    default_commands: normalizeObject(parsed.default_commands),
    default_mode: toNullableScalar(parsed.default_mode),
    delivery_policy: normalizeObject(parsed.delivery_policy),
    languages: normalizeStringArray(parsed.languages),
    output_policy: normalizeObject(parsed.output_policy),
    path: configPath,
    project_name: toNullableScalar(parsed.project_name),
    project_type: toNullableScalar(parsed.project_type),
    protected_paths: normalizeStringArray(parsed.protected_paths),
    risk_rules: normalizeObject(parsed.risk_rules),
    skill_policy: normalizeObject(parsed.skill_policy),
    task_templates: normalizeObject(parsed.task_templates),
    version: parsed.version ?? null
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toNullableScalar(item))
    .filter((item) => item != null)
    .map((item) => String(item));
}

function normalizeObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function toNullableScalar(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return null;
}

function parseSimpleYaml(content) {
  const lines = content.split("\n");
  const [parsed] = parseNode(lines, findNextMeaningfulLine(lines, 0), 0);
  return normalizeObject(parsed);
}

function parseNode(lines, startIndex, indent) {
  const firstIndex = findNextMeaningfulLine(lines, startIndex);
  if (firstIndex >= lines.length) {
    return [{}, lines.length];
  }

  const firstLine = lines[firstIndex];
  const firstIndent = countIndent(firstLine);
  if (firstIndent < indent) {
    return [{}, firstIndex];
  }

  if (lines[firstIndex].trim().startsWith("- ")) {
    return parseArray(lines, firstIndex, firstIndent);
  }

  return parseObject(lines, firstIndex, firstIndent);
}

function parseObject(lines, startIndex, indent) {
  const result = {};
  let index = startIndex;

  while (index < lines.length) {
    index = findNextMeaningfulLine(lines, index);
    if (index >= lines.length) {
      break;
    }

    const line = lines[index];
    const currentIndent = countIndent(line);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent > indent) {
      index += 1;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      break;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex < 0) {
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (rawValue.length > 0) {
      result[key] = parseScalar(rawValue);
      index += 1;
      continue;
    }

    const nextIndex = findNextMeaningfulLine(lines, index + 1);
    if (nextIndex >= lines.length || countIndent(lines[nextIndex]) <= currentIndent) {
      result[key] = {};
      index += 1;
      continue;
    }

    const [child, nextCursor] = parseNode(lines, nextIndex, countIndent(lines[nextIndex]));
    result[key] = child;
    index = nextCursor;
  }

  return [result, index];
}

function parseArray(lines, startIndex, indent) {
  const result = [];
  let index = startIndex;

  while (index < lines.length) {
    index = findNextMeaningfulLine(lines, index);
    if (index >= lines.length) {
      break;
    }

    const line = lines[index];
    const currentIndent = countIndent(line);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent > indent) {
      index += 1;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) {
      break;
    }

    const rawValue = trimmed.slice(2).trim();
    if (rawValue.length > 0) {
      result.push(parseScalar(rawValue));
      index += 1;
      continue;
    }

    const nextIndex = findNextMeaningfulLine(lines, index + 1);
    if (nextIndex >= lines.length || countIndent(lines[nextIndex]) <= currentIndent) {
      result.push(null);
      index += 1;
      continue;
    }

    const [child, nextCursor] = parseNode(lines, nextIndex, countIndent(lines[nextIndex]));
    result.push(child);
    index = nextCursor;
  }

  return [result, index];
}

function parseScalar(value) {
  const unquoted = unquote(value);
  if (unquoted === "true") {
    return true;
  }
  if (unquoted === "false") {
    return false;
  }
  if (unquoted === "null") {
    return null;
  }
  if (unquoted === "[]") {
    return [];
  }
  if (unquoted === "{}") {
    return {};
  }
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) {
    return Number(unquoted);
  }
  return unquoted;
}

function unquote(value) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function countIndent(line) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function findNextMeaningfulLine(lines, startIndex) {
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (trimmed !== "" && !trimmed.startsWith("#")) {
      return index;
    }
    index += 1;
  }
  return lines.length;
}
