import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Parent of per-run sub-agent outputs and finalized.json sentinels. */
export const CURATOR_RUNS_DIR = path.join(
  os.homedir(),
  ".ariadne",
  "triage-curator",
  "runs",
);

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

/** Absolute repo root — same value every script derives. Consumed by get_context_cmd builders. */
export function get_repo_root(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..", "..");
}

/** Relative path from repo root to the triage-curator scripts/ directory. */
export function get_scripts_rel(): string {
  return path.relative(get_repo_root(), path.join(get_repo_root(), ".claude", "skills", "triage-curator", "scripts"));
}

export function run_output_dir(run_id: string): string {
  return path.join(CURATOR_RUNS_DIR, run_id);
}

export function derive_run_id(run_path: string): string {
  return path.basename(run_path, ".json");
}

export function derive_project(run_path: string): string {
  // analysis_output/{project}/triage_results/{run_id}.json
  return path.basename(path.dirname(path.dirname(run_path)));
}
