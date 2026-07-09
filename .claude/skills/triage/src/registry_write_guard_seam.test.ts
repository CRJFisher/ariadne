/**
 * Integration tests for the registry write-guard's enforcement seam — the two
 * layers the unit tests over `evaluate_tool_call` cannot see:
 *
 * 1. The hook wrapper (`.claude/hooks/registry_write_guard.ts`): stdin
 *    parsing, the `hookSpecificOutput` emission that carries the `ask`, and
 *    the deliberate fail-open contract (malformed stdin → exit 0, no output).
 * 2. The `.claude/settings.json` wiring: dropping `Write` or `Edit` from the
 *    PreToolUse matcher would disable the checkpoint with every unit test
 *    still green.
 */

import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const HOOK_PATH = path.join(REPO_ROOT, ".claude/hooks/registry_write_guard.ts");
const SETTINGS_PATH = path.join(REPO_ROOT, ".claude/settings.json");
const REGISTRY_REL = ".claude/skills/triage/known_issues/registry.json";

const SPAWN_TIMEOUT_MS = 30_000;

function run_hook(stdin: string): { stdout: string; status: number | null } {
  const result = spawnSync("node", ["--import", "tsx", HOOK_PATH], {
    cwd: REPO_ROOT,
    input: stdin,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT },
  });
  if (result.error) throw result.error;
  return { stdout: result.stdout, status: result.status };
}

describe("registry_write_guard hook seam", () => {
  it("emits a PreToolUse ask for a registry Write", () => {
    const { stdout, status } = run_hook(
      JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: REGISTRY_REL, content: "[]" },
      }),
    );
    expect(status).toEqual(0);
    expect(JSON.parse(stdout)).toEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason:
          "This Write targets the human-owned classifier registry " +
          "(.claude/skills/triage/known_issues/registry.json). Per " +
          ".claude/rules/classifier-lifecycle.md every registry transition " +
          "is a per-edit human decision: approve only if you are " +
          "interactively directing this edit; an unattended pipeline agent " +
          "must route the transition back to the human " +
          "(reconcile_registry.ts --stage / --id ... --fixed --reason).",
      },
    });
  }, SPAWN_TIMEOUT_MS);

  it("stays silent for an ordinary file Write", () => {
    const { stdout, status } = run_hook(
      JSON.stringify({
        tool_name: "Write",
        tool_input: { file_path: "packages/core/src/index.ts", content: "x" },
      }),
    );
    expect(status).toEqual(0);
    expect(stdout).toEqual("");
  }, SPAWN_TIMEOUT_MS);

  // This exercises parse_stdin's null return, the fail-open contract's
  // input-facing layer. The wrapper's outer try/catch guards environmental
  // crashes (EPIPE on a closed stdout, an unwritable log file) that no stdin
  // payload can trigger, so it is not reachable from this seam.
  it("fails open on malformed stdin: exit 0, no output", () => {
    const { stdout, status } = run_hook("this is not json{{");
    expect(status).toEqual(0);
    expect(stdout).toEqual("");
  }, SPAWN_TIMEOUT_MS);
});

interface HookCommand {
  type: string;
  command: string;
}

interface PreToolUseEntry {
  matcher: string;
  hooks: HookCommand[];
}

interface HookSettings {
  // Property name is fixed by the Claude Code settings.json schema.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  hooks: { PreToolUse: PreToolUseEntry[] };
}

describe("registry_write_guard settings wiring", () => {
  it("wires the guard on a PreToolUse matcher covering Write and Edit", () => {
    const settings = JSON.parse(
      readFileSync(SETTINGS_PATH, "utf8"),
    ) as HookSettings;
    const guard_entries = settings.hooks.PreToolUse.filter((entry) =>
      entry.hooks.some((hook) =>
        hook.command.includes("registry_write_guard.ts"),
      ),
    );
    expect(guard_entries.map((entry) => entry.matcher)).toEqual([
      "Write|Edit",
    ]);
  });
});
