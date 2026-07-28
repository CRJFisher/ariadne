/**
 * Triage state file locations and shared CLI helpers.
 *
 * Layout: triage_state/<project>/runs/<run-id>/{triage.json, manifest.json,
 *   results/}
 * Plus a LATEST pointer at triage_state/<project>/LATEST recording the active run-id.
 *
 * Each call to a state-reading script may either default to the LATEST run for
 * `--project <name>` or pin a specific run via `--run-id <id>`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { read_latest_run_id } from "./latest_pointer.js";

// ===== Path normalization =====

/**
 * Normalize an entry's file path to the project-relative form published
 * member identities carry. State entries may hold absolute paths; published
 * `member_symbol` / TP-cache keys are always relative to `project_path`.
 * The publish side (`finalize/output.ts`) and every lookup against a
 * published identity must share this one function, or the match key drifts.
 */
export function relativize(file_path: string, project_path: string): string {
  if (!path.isAbsolute(file_path)) return file_path;
  return path.relative(project_path, file_path);
}

// ===== Base state directory =====

/**
 * Base directory for all triage state. Defaults to
 * `~/.ariadne/triage-entrypoints`. Tests set
 * `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE` to an isolated temp directory
 * before importing this module.
 *
 * `triage-entrypoints` is the fixed on-disk storage namespace, independent of
 * the skill name.
 */
const STATE_DIR =
  process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE ??
  path.join(os.homedir(), ".ariadne", "triage-entrypoints");

export const TRIAGE_STATE_DIR = path.join(STATE_DIR, "triage_state");

export const RUNS_SUBDIR = "runs";
export const LATEST_FILENAME = "LATEST";

// ===== Filenames =====

export const TRIAGE_STATE_FILENAME = "triage.json";
export const RUN_MANIFEST_FILENAME = "manifest.json";
export const RESULTS_SUBDIR = "results";

// ===== Pure path builders (no I/O) =====

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

/** Path to a specific run's directory. Existence is not checked. */
export function run_dir_for(project: string, run_id: string): string {
  return path.join(runs_dir_for(project), run_id);
}

/** Path to a run's triage.json. Existence is not checked. */
export function state_path_for(project: string, run_id: string): string {
  return path.join(run_dir_for(project, run_id), TRIAGE_STATE_FILENAME);
}

/** Path to a run's manifest.json. Existence is not checked. */
export function manifest_path_for(project: string, run_id: string): string {
  return path.join(run_dir_for(project, run_id), RUN_MANIFEST_FILENAME);
}

/** Path to a run's results/ subdir. Existence is not checked. */
export function results_dir_for(project: string, run_id: string): string {
  return path.join(run_dir_for(project, run_id), RESULTS_SUBDIR);
}

// ===== Discovery =====

/** List project subdirectories that have a non-empty runs/ directory. */
export function list_projects_with_state(triage_dir: string = TRIAGE_STATE_DIR): string[] {
  if (!fs.existsSync(triage_dir)) return [];
  const entries = fs.readdirSync(triage_dir, { withFileTypes: true });
  const projects: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const runs_dir = path.join(triage_dir, entry.name, "runs");
    if (!fs.existsSync(runs_dir)) continue;
    const subs = fs
      .readdirSync(runs_dir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    if (subs.length > 0) projects.push(entry.name);
  }
  return projects;
}

// ===== Run resolution =====

export interface ResolvedRun {
  run_id: string;
  run_dir: string;
  state_path: string;
  manifest_path: string;
}

/** Name the run under `(project, run_id_opt)`, defaulting to the LATEST pointer, or exit(1). */
function resolve_run_id(project: string, run_id_opt: string | null): string {
  if (run_id_opt !== null) return run_id_opt;

  const latest = read_latest_run_id(project);
  if (latest === null) {
    const lines = [
      `Error: no active run for project "${project}".`,
      `Expected LATEST pointer at ${latest_pointer_for(project)}.`,
      "Run prepare_triage.ts to start a new run, or pass --run-id <id> to target a specific run.",
    ];
    process.stderr.write(lines.join("\n") + "\n");
    process.exit(1);
  }
  return latest;
}

function resolved_run(project: string, run_id: string): ResolvedRun {
  return {
    run_id,
    run_dir: run_dir_for(project, run_id),
    state_path: state_path_for(project, run_id),
    manifest_path: manifest_path_for(project, run_id),
  };
}

/**
 * Resolve `(project, run_id_opt)` to concrete paths or exit(1) with an actionable
 * error. `run_id_opt === null` defaults to the project's LATEST pointer.
 *
 * For callers that read or write the run's entries. A run without `triage.json`
 * has no entries to operate on, so its absence is fatal here.
 */
export function require_run(project: string, run_id_opt: string | null): ResolvedRun {
  const run_id = resolve_run_id(project, run_id_opt);

  const state_path = state_path_for(project, run_id);
  if (!fs.existsSync(state_path)) {
    process.stderr.write(
      `Error: state file not found for run "${run_id}" of project "${project}" at ${state_path}.\n`,
    );
    process.exit(1);
  }

  return resolved_run(project, run_id);
}

/**
 * Resolve `(project, run_id_opt)` against the run's manifest alone, or exit(1).
 *
 * `prepare_triage` stamps the manifest `active` before writing `triage.json`, so
 * a run interrupted between those two writes owns a live manifest and no state.
 * That run still has to be abandonable — it is exactly the state a crash leaves
 * behind, and the active-run guard blocks the project until it is cleared. Any
 * caller whose whole job is the manifest resolves through here.
 */
export function require_run_manifest(project: string, run_id_opt: string | null): ResolvedRun {
  const run_id = resolve_run_id(project, run_id_opt);

  const manifest_path = manifest_path_for(project, run_id);
  if (!fs.existsSync(manifest_path)) {
    process.stderr.write(
      `Error: manifest not found for run "${run_id}" of project "${project}" at ${manifest_path}.\n`,
    );
    process.exit(1);
  }

  return resolved_run(project, run_id);
}

// CLI parsers (parse_project_arg, parse_run_id_arg) live in `cli_args.ts` —
// they're generic argv shaping and have no dependency on path layout.
