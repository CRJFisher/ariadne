/**
 * Triage state file locations and shared CLI helpers.
 *
 * Layout: triage_state/<project>/runs/<run-id>/{triage.json, manifest.json, results/, aggregation/}
 * Plus a LATEST pointer at triage_state/<project>/LATEST recording the active run-id.
 *
 * Each call to a state-reading script may either default to the LATEST run for
 * `--project <name>` or pin a specific run via `--run-id <id>`.
 */

import * as crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  TRIAGE_STATE_DIR,
  latest_pointer_for,
  project_state_dir,
  runs_dir_for,
} from "./paths.js";

export const TRIAGE_STATE_FILENAME = "triage.json";
export const RUN_MANIFEST_FILENAME = "manifest.json";
export const RESULTS_SUBDIR = "results";
export const AGGREGATION_SUBDIR = "aggregation";

// ===== Pure path builders (no I/O) =====

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

/** Path to a run's aggregation/ subdir. Existence is not checked. */
export function aggregation_dir_for(project: string, run_id: string): string {
  return path.join(run_dir_for(project, run_id), AGGREGATION_SUBDIR);
}

// ===== LATEST pointer I/O =====

/** Read the LATEST pointer for a project. Returns null when the pointer is absent. */
export function read_latest_run_id(project: string): string | null {
  const ptr = latest_pointer_for(project);
  if (!fs.existsSync(ptr)) return null;
  const text = fs.readFileSync(ptr, "utf8").trim();
  return text.length > 0 ? text : null;
}

/** Atomically write the LATEST pointer (write `.tmp.<rand>` + rename). */
export function write_latest_run_id(project: string, run_id: string): void {
  const dir = project_state_dir(project);
  fs.mkdirSync(dir, { recursive: true });
  const final_path = latest_pointer_for(project);
  const tmp_path = `${final_path}.tmp.${crypto.randomBytes(4).toString("hex")}`;
  fs.writeFileSync(tmp_path, run_id + "\n", "utf8");
  fs.renameSync(tmp_path, final_path);
}

/** Remove the LATEST pointer if present. No-op when already absent. */
export function clear_latest(project: string): void {
  const ptr = latest_pointer_for(project);
  if (fs.existsSync(ptr)) fs.unlinkSync(ptr);
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

/**
 * Resolve `(project, run_id_opt)` to concrete paths or exit(1) with an actionable
 * error. `run_id_opt === null` defaults to the project's LATEST pointer.
 */
export function require_run(project: string, run_id_opt: string | null): ResolvedRun {
  let run_id = run_id_opt;
  if (run_id === null) {
    run_id = read_latest_run_id(project);
    if (run_id === null) {
      const lines = [
        `Error: no active run for project "${project}".`,
        `Expected LATEST pointer at ${latest_pointer_for(project)}.`,
        "Run prepare_triage.ts to start a new run, or pass --run-id <id> to target a specific run.",
      ];
      process.stderr.write(lines.join("\n") + "\n");
      process.exit(1);
    }
  }

  const state_path = state_path_for(project, run_id);
  if (!fs.existsSync(state_path)) {
    process.stderr.write(
      `Error: state file not found for run "${run_id}" of project "${project}" at ${state_path}.\n`,
    );
    process.exit(1);
  }

  return {
    run_id,
    run_dir: run_dir_for(project, run_id),
    state_path,
    manifest_path: manifest_path_for(project, run_id),
  };
}

// CLI parsers (parse_project_arg, parse_run_id_arg) live in `cli_args.ts` —
// they're generic argv shaping and have no dependency on path layout.
