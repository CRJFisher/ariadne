#!/usr/bin/env npx tsx
/**
 * PreToolUse hook: route any agent write to the classifier registry through a
 * per-edit human `ask`.
 *
 * WHY ask, not deny: .claude/rules/classifier-lifecycle.md defines every
 * registry transition as a per-edit human decision. `ask` is the only
 * permission outcome that both re-raises a prompt under
 * defaultMode:"acceptEdits" AND lets an interactive human approve — a deny
 * would block the sanctioned human-directed edit, and staying silent would let
 * acceptEdits auto-accept. In headless mode an unanswerable `ask` resolves to
 * deny, which fails closed for unattended agents.
 *
 * WHY the legacy `decision` field is not used: it only expresses
 * approve/block; only `hookSpecificOutput.permissionDecision` carries `ask`.
 *
 * WHY try/catch → silent exit 0: a crashing PreToolUse hook must fail open
 * predictably rather than block every unrelated Write/Edit in the repo;
 * the harness permission classifier remains defense-in-depth for that window.
 *
 * All decision logic (and its tests) lives in the triage package —
 * `.claude/skills/triage/src/registry_write_guard.ts` — because this
 * directory is outside the repo's lint/typecheck nets and the guard's
 * domain (the classifier registry) is the triage package's.
 */

import { parse_stdin, get_project_dir, create_logger } from "./utils.js";
import { evaluate_tool_call } from "../skills/triage/src/registry_write_guard.js";

const log = create_logger("registry-write-guard");

function main(): void {
  const input = parse_stdin();
  if (!input) return;

  const result = evaluate_tool_call({
    tool_name: input.tool_name as string,
    tool_input: input.tool_input as Record<string, unknown> | undefined,
    project_dir: get_project_dir(),
  });
  if (result.decision !== "ask") return;

  // Emit before logging: the decision is the load-bearing output, and an
  // unwritable log file must not swallow the ask and fail open on the exact
  // write the guard exists to gate.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: result.reason,
      },
    }),
  );
  const tool_input = input.tool_input as Record<string, unknown> | undefined;
  const target = String(tool_input?.file_path ?? "");
  safe_log(`ask on ${String(input.tool_name)}: ${target.slice(0, 160)}`);
}

function safe_log(message: string): void {
  try {
    log(message);
  } catch {
    // Logging must never break the hook or suppress its decision.
  }
}

try {
  main();
} catch (err) {
  safe_log(`fail-open: ${err instanceof Error ? err.message : String(err)}`);
}
