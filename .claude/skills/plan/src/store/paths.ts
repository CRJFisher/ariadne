import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parent of per-run sub-agent outputs and finalized.json sentinels.
 *
 * `triage-curator` is the fixed on-disk storage namespace, independent of the
 * skill name. The plan-strategist agent's `Write` grant and the SKILL/README
 * run paths reference the same namespace.
 */
export const CURATOR_RUNS_DIR = path.join(
  os.homedir(),
  ".ariadne",
  "triage-curator",
  "runs",
);

/** Absolute repo root — same value every script derives. Consumed by get_context_cmd builders. */
export function get_repo_root(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/store/ → src/ → plan/ → skills/ → .claude/ → repo root
  return path.resolve(here, "..", "..", "..", "..", "..");
}

/** Relative path from repo root to the scripts/ directory. */
export function get_scripts_rel(): string {
  return path.relative(get_repo_root(), path.join(get_repo_root(), ".claude", "skills", "plan", "scripts"));
}

export function run_output_dir(run_id: string): string {
  return path.join(CURATOR_RUNS_DIR, run_id);
}

