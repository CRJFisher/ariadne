/**
 * Pure decision logic for the registry write-guard PreToolUse hook
 * (`.claude/hooks/registry_write_guard.ts`).
 *
 * The classifier registry is the human-owned loop-closure surface
 * (`.claude/rules/classifier-lifecycle.md`): every write is a per-edit human
 * decision. This module decides, from a single `Write`/`Edit` tool call,
 * whether that call would write the registry and therefore must be routed to a
 * human `ask`. Shell-based writes are out of scope — the hook matches only
 * `Write`/`Edit`, and the harness `[Self-Modification]` classifier is the
 * defense-in-depth layer for the Bash surface.
 *
 * The logic lives here — inside the triage workspace package — rather than in
 * `.claude/hooks/`, because that directory is outside every test, lint, and
 * typecheck net; a guard whose tests never run is the failure mode this hook
 * exists to close. The hook entry under `.claude/hooks/` is a thin stdin/emit
 * wrapper over `evaluate_tool_call`.
 */

import path from "path";

export type GuardDecision =
  | { decision: "pass" }
  | { decision: "ask"; reason: string };

const REGISTRY_REL = ".claude/skills/triage/known_issues/registry.json";

const PER_EDIT_CONTRACT =
  "Per .claude/rules/classifier-lifecycle.md every registry transition is a " +
  "per-edit human decision: approve only if you are interactively directing " +
  "this edit; an unattended pipeline agent must route the transition back to " +
  "the human (reconcile_registry.ts --stage / --id ... --fixed --reason).";

/**
 * True when `candidate` resolves to the registry or its `.lock` sidecar.
 * Comparison is repo-relative so the guard works identically in git worktrees,
 * where the absolute prefix differs but the layout does not.
 */
function resolves_to_registry(candidate: string, project_dir: string): boolean {
  const rel = path.relative(project_dir, path.resolve(project_dir, candidate));
  return rel === REGISTRY_REL || rel === `${REGISTRY_REL}.lock`;
}

export function evaluate_tool_call(input: {
  tool_name: string;
  tool_input: Record<string, unknown> | undefined;
  project_dir: string;
}): GuardDecision {
  const { tool_name, tool_input, project_dir } = input;

  if (tool_name === "Write" || tool_name === "Edit") {
    const file_path = tool_input?.file_path;
    if (typeof file_path !== "string" || file_path.length === 0) {
      return { decision: "pass" };
    }
    if (resolves_to_registry(file_path, project_dir)) {
      return {
        decision: "ask",
        reason:
          `This ${tool_name} targets the human-owned classifier registry ` +
          `(${REGISTRY_REL}). ${PER_EDIT_CONTRACT}`,
      };
    }
    return { decision: "pass" };
  }

  return { decision: "pass" };
}
