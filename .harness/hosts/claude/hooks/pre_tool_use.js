import {
  firstString,
  readHookPayload,
  resolvePayloadCwd,
  writeHookOutput
} from "../../shared/payload-io.js";
import { importRuntimeModule } from "../../shared/runtime-loader.js";

try {
  const payload = readHookPayload();
  const cwd = resolvePayloadCwd(payload);
  const { handleBeforeTool, buildClaudeHookOutput } = await importRuntimeModule("runtime-host", cwd);
  const result = handleBeforeTool({
    command: firstString([
      payload?.tool_input?.command,
      payload?.toolInput?.command,
      payload?.input?.command,
      payload?.arguments?.command,
      payload?.tool_use?.input?.command,
      payload?.toolUse?.input?.command,
      payload?.command
    ]) ?? "",
    cwd,
    filePath: firstString([
      payload?.tool_input?.file_path,
      payload?.tool_input?.path,
      payload?.toolInput?.file_path,
      payload?.toolInput?.path,
      payload?.input?.file_path,
      payload?.input?.path,
      payload?.arguments?.file_path,
      payload?.arguments?.path,
      payload?.tool_use?.input?.file_path,
      payload?.tool_use?.input?.path,
      payload?.toolUse?.input?.file_path,
      payload?.toolUse?.input?.path
    ]),
    taskId: firstString([
      payload?.task_id,
      payload?.taskId,
      payload?.context?.task_id,
      payload?.context?.taskId
    ]),
    toolName: firstString([
      payload?.tool_name,
      payload?.toolName,
      payload?.tool?.name,
      payload?.toolUse?.name,
      payload?.name
    ])
  });
  writeHookOutput(buildClaudeHookOutput("PreToolUse", result));
} catch {
  writeHookOutput({});
}
