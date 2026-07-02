/**
 * Pure decision logic for the registry write-guard PreToolUse hook
 * (`.claude/hooks/registry_write_guard.ts`).
 *
 * The classifier registry is the human-owned loop-closure surface
 * (`.claude/rules/classifier-lifecycle.md`): every write is a per-edit human
 * decision. This module decides, from a single tool call, whether that call
 * would write the registry and therefore must be routed to a human `ask`.
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
 * Bash write indicators. A command that merely reads the registry
 * (cat/jq/grep/git show) must pass — a guard that prompts on every read is
 * noise the human learns to click through or disables outright. Lexical
 * token-matching, not shell parsing: the goal is the realistic accident
 * surface (an agent literally typing a redirect or an in-place edit), with
 * the harness permission classifier as defense-in-depth for the adversarial
 * tail (variable indirection, eval, computed paths).
 */
const BASH_WRITE_INDICATORS = [
  />/, // covers > and >>
  /\btee\b/,
  /\bsed\s+(-\S+\s+)*-i\b/,
  /\bperl\s+(-\S+\s+)*-i\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\brm\b/,
  /\bdd\b/,
  /\btruncate\b/,
  /writeFileSync|appendFileSync|writeFile|appendFile/,
];

/**
 * True when a reconcile_registry.ts invocation is write-mode. The script
 * applies detected proposals by default — a bare invocation writes — so the
 * check is inverted: only explicitly read-only forms pass (`--dry-run`,
 * `--help`, or `--stage` without `--apply`, which previews the draft).
 */
function is_write_mode_reconcile(command: string): boolean {
  if (!command.includes("reconcile_registry.ts")) return false;
  if (command.includes("--dry-run") || command.includes("--help")) return false;
  if (command.includes("--stage") && !command.includes("--apply")) return false;
  return true;
}

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

  if (tool_name === "Bash") {
    const command = tool_input?.command;
    if (typeof command !== "string" || command.length === 0) {
      return { decision: "pass" };
    }
    // The sanctioned write path never names registry.json on its command
    // line — it names the script — so it needs its own clause: an agent
    // running the reconciler in write-mode IS an unattended registry write,
    // laundered through the blessed script.
    if (is_write_mode_reconcile(command)) {
      return {
        decision: "ask",
        reason:
          "This command runs reconcile_registry.ts in write-mode (no " +
          `--dry-run), which writes the classifier registry. ${PER_EDIT_CONTRACT}`,
      };
    }
    if (
      command.includes("registry.json") &&
      BASH_WRITE_INDICATORS.some((indicator) => indicator.test(command))
    ) {
      return {
        decision: "ask",
        reason:
          "This command references the human-owned classifier registry " +
          `(${REGISTRY_REL}) alongside a write indicator (redirect, tee, ` +
          `sed -i, mv/cp/rm, ...). ${PER_EDIT_CONTRACT}`,
      };
    }
    return { decision: "pass" };
  }

  return { decision: "pass" };
}
