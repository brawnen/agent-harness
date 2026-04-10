import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { autoIntakePrompt, classifyUserOverridePrompt, createTaskFromInput } from "../src/lib/task-core.js";
import { updateTaskState } from "../src/lib/state-store.js";

const fixturesPath = path.resolve(process.cwd(), "fixtures", "task-core-classification.json");
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, "utf8"));
const baseTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-harness-task-core-fixtures-"));

let failures = 0;
let passed = 0;

for (const fixture of fixtures.cases ?? []) {
  const cwd = path.join(baseTempDir, fixture.name);
  fs.mkdirSync(cwd, { recursive: true });

  if (fixture.active_task) {
    const createdTask = createTaskFromInput(cwd, fixture.active_task.input, {
      scope: fixture.active_task.scope ?? [],
      acceptance: fixture.active_task.acceptance ?? []
    });

    if (fixture.active_task.state && fixture.active_task.state !== createdTask.current_state) {
      updateTaskState(cwd, createdTask.task_id, {
        current_state: fixture.active_task.state
      });
    }
  }

  const result = autoIntakePrompt(cwd, fixture.prompt);
  const actual = {
    action: result.action,
    decision_type: result.decision?.type ?? null,
    reason_code: result.decision?.reason_code ?? null,
    block: Boolean(result.block)
  };

  const expected = fixture.expected ?? {};
  const mismatches = [];

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      mismatches.push(`${key}: expected=${JSON.stringify(expectedValue)} actual=${JSON.stringify(actual[key])}`);
    }
  }

  if (mismatches.length > 0) {
    failures += 1;
    console.error(`FAIL ${fixture.name}`);
    for (const mismatch of mismatches) {
      console.error(`  ${mismatch}`);
    }
    console.error(`  prompt=${JSON.stringify(fixture.prompt)}`);
    console.error(`  decision=${JSON.stringify(result.decision)}`);
    continue;
  }

  passed += 1;
  console.log(`PASS ${fixture.name} -> ${actual.decision_type}/${actual.reason_code}`);
}

const overrideCases = [
  {
    expectedType: null,
    prompt: "继续"
  },
  {
    expectedType: "manual_confirmation",
    prompt: "继续执行"
  }
];

for (const overrideCase of overrideCases) {
  const decision = classifyUserOverridePrompt(overrideCase.prompt);
  const actualType = decision?.type ?? null;

  if (actualType !== overrideCase.expectedType) {
    failures += 1;
    console.error(`FAIL override ${JSON.stringify(overrideCase.prompt)}`);
    console.error(`  expected=${JSON.stringify(overrideCase.expectedType)} actual=${JSON.stringify(actualType)}`);
    continue;
  }

  passed += 1;
  console.log(`PASS override ${JSON.stringify(overrideCase.prompt)} -> ${actualType ?? "null"}`);
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed, ${passed} case(s) passed.`);
  process.exit(1);
}

console.log(`\nAll ${passed} classification fixture(s) passed.`);
