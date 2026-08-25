/**
 * Where a triage store's artifacts live *relative to an arbitrary store root*.
 *
 * `paths.ts` answers the same question for *the local store* — it resolves one
 * root from `$HOME` (or the test override) and bakes it into every builder. That
 * is the right shape for the pipeline, which only ever touches one store. It is
 * the wrong shape for the tools that reason about two stores at once: surveying
 * an unpacked transfer bundle, or merging that bundle into the local store. Those
 * need the same layout applied to a root passed in as an argument.
 *
 * So the layout lives here, parameterized by root, and `paths.ts` stays the
 * single owner of *which* root the pipeline uses. The subdirectory names are
 * imported from their owners wherever one exists; the two that skill-protocol
 * keeps private are mirrored below and pinned by a test that re-derives them
 * from skill-protocol's own builders, so the copy cannot drift unnoticed.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { OutputType } from "./analysis_output.js";
import {
  RUNS_SUBDIR,
  RESULTS_SUBDIR,
  RUN_MANIFEST_FILENAME,
  TRIAGE_STATE_FILENAME,
  TRIAGE_STATE_SUBDIR,
} from "./paths.js";

/** Mirrors skill-protocol's private `analysis_output` segment. Pinned by test. */
export const ANALYSIS_OUTPUT_SUBDIR = "analysis_output";

/** Per-project pipeline configuration, one `<project_id>.json` per project. */
export const PROJECT_CONFIGS_SUBDIR = "project_configs";

/** Shallow clones of the target corpora. Re-creatable; never part of a bundle. */
export const REPOS_SUBDIR = "repos";

/** Default local store root, honoring the same override `paths.ts` reads. */
export function default_store_dir(): string {
  return (
    process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE ??
    path.join(os.homedir(), ".ariadne", "triage-entrypoints")
  );
}

// ===== Roots =====

export function state_root(store_dir: string): string {
  return path.join(store_dir, TRIAGE_STATE_SUBDIR);
}

export function analysis_root(store_dir: string): string {
  return path.join(store_dir, ANALYSIS_OUTPUT_SUBDIR);
}

export function project_configs_root(store_dir: string): string {
  return path.join(store_dir, PROJECT_CONFIGS_SUBDIR);
}

export function repos_root(store_dir: string): string {
  return path.join(store_dir, REPOS_SUBDIR);
}

// ===== Per-project run state =====

export function project_state_dir(store_dir: string, project: string): string {
  return path.join(state_root(store_dir), project);
}

export function runs_root(store_dir: string, project: string): string {
  return path.join(project_state_dir(store_dir, project), RUNS_SUBDIR);
}

export function run_dir(store_dir: string, project: string, run_id: string): string {
  return path.join(runs_root(store_dir, project), run_id);
}

export function state_file(store_dir: string, project: string, run_id: string): string {
  return path.join(run_dir(store_dir, project, run_id), TRIAGE_STATE_FILENAME);
}

export function manifest_file(store_dir: string, project: string, run_id: string): string {
  return path.join(run_dir(store_dir, project, run_id), RUN_MANIFEST_FILENAME);
}

export function results_root(store_dir: string, project: string, run_id: string): string {
  return path.join(run_dir(store_dir, project, run_id), RESULTS_SUBDIR);
}

// ===== Per-project published output =====

export function project_analysis_dir(store_dir: string, project: string): string {
  return path.join(analysis_root(store_dir), project);
}

export function triage_results_root(store_dir: string, project: string): string {
  return path.join(project_analysis_dir(store_dir, project), OutputType.TRIAGE_RESULTS);
}

export function triage_results_file(
  store_dir: string,
  project: string,
  run_id: string,
): string {
  return path.join(triage_results_root(store_dir, project), `${run_id}.json`);
}

export function detect_entrypoints_root(store_dir: string, project: string): string {
  return path.join(project_analysis_dir(store_dir, project), OutputType.DETECT_ENTRYPOINTS);
}

export function project_config_file(store_dir: string, project: string): string {
  return path.join(project_configs_root(store_dir), `${project}.json`);
}

// ===== Discovery =====

/**
 * Immediate subdirectory names of `dir`, sorted. Absent `dir` yields none.
 *
 * Dot-directories are never store entries — no project id or run id starts
 * with a dot, while tooling drops scratch dirs such as `.claude/.cc-writes`
 * beside them — so they are not surveyed as projects or runs.
 */
export function list_subdirectories(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

/** Every project that owns a `triage_state/` directory, whether or not it has runs. */
export function list_state_projects(store_dir: string): string[] {
  return list_subdirectories(state_root(store_dir));
}

/** Every project that owns an `analysis_output/` directory. */
export function list_analysis_projects(store_dir: string): string[] {
  return list_subdirectories(analysis_root(store_dir));
}

/** Every run id recorded for a project, sorted. */
export function list_run_ids(store_dir: string, project: string): string[] {
  return list_subdirectories(runs_root(store_dir, project));
}
