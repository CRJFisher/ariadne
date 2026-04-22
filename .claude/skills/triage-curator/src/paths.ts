import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CURATOR_STATE_DIR = path.join(os.homedir(), ".ariadne", "triage-curator");
export const CURATOR_STATE_FILE = path.join(CURATOR_STATE_DIR, "state.json");

/** Where per-run sub-agent outputs land (keeps main-agent context small). */
export const CURATOR_RUNS_DIR = path.join(CURATOR_STATE_DIR, "runs");

/** Read-only source of triage_results JSON files. */
export const SELF_REPAIR_ANALYSIS_OUTPUT_DIR = path.join(
  os.homedir(),
  ".ariadne",
  "self-repair-pipeline",
  "analysis_output",
);

/** Resolves to the self-repair-pipeline known_issues/registry.json in the current repo checkout. */
export function get_registry_file_path(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/ → skill root → ../self-repair-pipeline/known_issues/registry.json
  return path.resolve(here, "..", "..", "self-repair-pipeline", "known_issues", "registry.json");
}

export function run_output_dir(run_id: string): string {
  return path.join(CURATOR_RUNS_DIR, run_id);
}
