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
 * Bash write patterns, each binding the write construct to the registry path
 * itself. A command that merely reads the registry (cat/jq/grep/git show) —
 * or that reads it and redirects the OUTPUT somewhere else — must pass: a
 * guard that prompts on reads is noise the human learns to click through or
 * disables outright. Lexical token-matching, not shell parsing: the goal is
 * the realistic accident surface (an agent literally typing a redirect or an
 * in-place edit against the registry), with the harness permission classifier
 * as defense-in-depth for the adversarial tail (variable indirection, eval,
 * computed paths). `[^|;&]*` keeps each match inside one pipeline segment so
 * a write token in an unrelated segment cannot pair with a registry read.
 */
const BASH_WRITE_PATTERNS = [
  />{1,2}\s*\S*registry\.json(\.lock)?\b/,
  /(^|[\s;&|])tee\s[^|;&]*registry\.json/,
  /(^|[\s;&|])(sed|perl)\s[^|;&]*-i\S*\s[^|;&]*registry\.json/,
  // Command-position anchor, not \b: a flag cluster like `grep -rm 5` must
  // not read as an `rm` invocation.
  /(^|[\s;&|])(mv|cp|rm|dd|truncate)\s[^|;&]*registry\.json/,
  // git checkout/restore silently replace the registry with the committed
  // version — an accident-surface overwrite, not an adversarial one.
  /(^|[\s;&|])git\s+(checkout|restore)\s[^|;&]*registry\.json/,
  /\b(writeFileSync|appendFileSync|writeFile|appendFile)\b[^|;&]*registry\.json/,
];

/**
 * True when the command carries `flag` as a real token. Quoted segments are
 * stripped first so a flag mentioned inside an argument — e.g.
 * `--reason "see --dry-run docs"` — cannot spoof read-only mode.
 */
function has_flag(command: string, flag: string): boolean {
  const unquoted = command
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ");
  return new RegExp(`(^|\\s)${flag}(=|\\s|$)`).test(unquoted);
}

/**
 * True when a Bash command EXECUTES reconcile_registry.ts in write-mode. A
 * mere mention of the script path (grep/cat/an editor opening it) must pass —
 * the execution form requires a runner token before the script path. The
 * script applies detected proposals by default — a bare invocation writes —
 * so the flag check is inverted: only explicitly read-only forms pass
 * (`--dry-run`, `--help`, or `--stage` without `--apply`; `--stage` is
 * dry-run by default and writes only with `--apply`).
 */
const RECONCILE_EXECUTION = /\b(node|npx|tsx|pnpm)\b[^|;&]*reconcile_registry\.ts/;

function is_write_mode_reconcile(command: string): boolean {
  if (!RECONCILE_EXECUTION.test(command)) return false;
  if (has_flag(command, "--dry-run") || has_flag(command, "--help")) return false;
  if (has_flag(command, "--stage") && !has_flag(command, "--apply")) return false;
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
    if (BASH_WRITE_PATTERNS.some((pattern) => pattern.test(command))) {
      return {
        decision: "ask",
        reason:
          "This command applies a write construct (redirect, tee, sed -i, " +
          "mv/cp/rm, ...) to the human-owned classifier registry " +
          `(${REGISTRY_REL}). ${PER_EDIT_CONTRACT}`,
      };
    }
    return { decision: "pass" };
  }

  return { decision: "pass" };
}
