import { applyHostLayoutWrites, collectHostLayoutWrites, HOST_LAYOUT_HOSTS } from "../lib/host-layout.js";

export function runSync(argv) {
  const parsed = parseSyncArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }

  const cwd = process.cwd();
  const result = collectHostLayoutWrites(cwd, {
    check: parsed.options.check,
    hosts: parsed.options.hosts,
    rewrite: parsed.options.rewrite,
    seedMissing: true
  });

  for (const warning of result.warnings) {
    console.error(`warn: ${warning}`);
  }

  if (parsed.options.check) {
    if (result.warnings.length === 0 && result.writes.length === 0) {
      console.log("host layout 已同步");
      return 0;
    }

    for (const write of result.writes) {
      console.log(`drift: ${write.relativePath}`);
    }
    return 1;
  }

  applyHostLayoutWrites(result.writes);

  for (const write of result.writes) {
    console.log(`write: ${write.relativePath}`);
  }

  if (result.warnings.length > 0) {
    return 1;
  }

  console.log("sync 完成。");
  return 0;
}

function parseSyncArgs(argv) {
  const options = {
    check: false,
    hosts: null,
    rewrite: false
  };

  const hosts = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--check") {
      options.check = true;
      continue;
    }

    if (arg === "--rewrite") {
      options.rewrite = true;
      continue;
    }

    if (arg === "--host") {
      const value = argv[index + 1];
      if (!HOST_LAYOUT_HOSTS.includes(value)) {
        return { ok: false, error: "无效的 --host 参数。可选值: codex, claude-code, gemini-cli" };
      }
      hosts.push(value);
      index += 1;
      continue;
    }

    return { ok: false, error: `未知参数: ${arg}` };
  }

  if (hosts.length > 0) {
    options.hosts = hosts;
  }

  return { ok: true, options };
}
