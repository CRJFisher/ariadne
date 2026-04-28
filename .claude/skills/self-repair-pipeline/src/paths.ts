import os from "os";
import path from "path";

/**
 * Base directory for all self-repair-pipeline state. Defaults to
 * `~/.ariadne/self-repair-pipeline`. Tests set
 * `ARIADNE_SELF_REPAIR_DIR_OVERRIDE` to an isolated temp directory before
 * importing this module.
 */
const STATE_DIR =
  process.env.ARIADNE_SELF_REPAIR_DIR_OVERRIDE ??
  path.join(os.homedir(), ".ariadne", "self-repair-pipeline");

export const ANALYSIS_OUTPUT_DIR = path.join(STATE_DIR, "analysis_output");
export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");

export const RUNS_SUBDIR = "runs";
export const LATEST_FILENAME = "LATEST";

/** Path to the per-project parent that owns the runs/ subdir and LATEST pointer. */
export function project_state_dir(project_name: string): string {
  return path.join(TRIAGE_STATE_DIR, project_name);
}

/** Path to the per-project runs/ directory. Existence is not checked. */
export function runs_dir_for(project_name: string): string {
  return path.join(project_state_dir(project_name), RUNS_SUBDIR);
}

/** Path to the per-project LATEST pointer file. Existence is not checked. */
export function latest_pointer_for(project_name: string): string {
  return path.join(project_state_dir(project_name), LATEST_FILENAME);
}
