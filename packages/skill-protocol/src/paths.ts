/**
 * Filesystem-protocol path resolution for the `triage` → `plan` seam.
 *
 * Two location families live here:
 *   - the published `analysis_output/<project>/triage_results/<run-id>.json`
 *     artifacts the producer writes and the consumer reads, and
 *   - the single known-issues registry both skills resolve.
 *
 * Per-run scratch state (`triage_state/<project>/runs/...`) and the `plan`
 * engine's task-DB under `~/.ariadne/plan/` stay owned by their respective
 * skills; only the cross-skill protocol paths are centralized here.
 *
 * The triage base directory honors `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE`,
 * read lazily on every call, so a test that sets the override before importing
 * a consumer module still wins.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse_run_id, type RunId } from "./run_id.js";

const TRIAGE_RESULTS_SUBDIR = "triage_results";

/**
 * Base state directory for the triage pipeline. Defaults to
 * `~/.ariadne/triage-entrypoints`; overridable for test isolation via
 * `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE`. Read lazily.
 *
 * `triage-entrypoints` is the fixed on-disk storage namespace, independent of
 * the skill name.
 */
function state_dir(): string {
  return (
    process.env.ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE ??
    path.join(os.homedir(), ".ariadne", "triage-entrypoints")
  );
}

/** Parent directory of all published analysis output, `<state>/analysis_output`. */
export function analysis_output_dir(): string {
  return path.join(state_dir(), "analysis_output");
}

/** A project's `triage_results/` directory. Existence is not checked. */
export function triage_results_dir(project: string): string {
  return path.join(analysis_output_dir(), project, TRIAGE_RESULTS_SUBDIR);
}

/**
 * Path to a project's published `triage_results/<run-id>.json`. Existence is
 * not checked. `run_id` is typed `string` so callers can pass a freshly built
 * `RunId` (a subtype) without a cast.
 */
export function triage_results_path(project: string, run_id: string): string {
  return path.join(triage_results_dir(project), `${run_id}.json`);
}

/**
 * Inverse of {@link triage_results_path}: recover `{ project, run_id }` from a
 * published-artifact path. Validates the run-id via {@link parse_run_id} and
 * throws on a malformed filename — use only on paths known to name a produced
 * run (a `--run` argument, a finalize target), not for bulk discovery.
 */
export function parse_triage_results_path(file_path: string): {
  project: string;
  run_id: RunId;
} {
  const run_id = parse_run_id(path.basename(file_path, ".json"));
  // …/<project>/triage_results/<run-id>.json → project is two directories up.
  const project = path.basename(path.dirname(path.dirname(file_path)));
  return { project, run_id };
}

/**
 * Absolute path to the known-issues registry. The single resolver for both
 * skills: the repo root is located by walking up to the directory containing
 * `pnpm-workspace.yaml` (robust to where the importing skill lives and to the
 * cwd a script runs under), then the registry's fixed location is joined.
 */
export function known_issues_registry_path(): string {
  return path.join(
    find_repo_root(),
    ".claude",
    "skills",
    "triage",
    "known_issues",
    "registry.json",
  );
}

/** Walk up from this module until the directory holding `pnpm-workspace.yaml`. */
function find_repo_root(): string {
  const start = path.dirname(fileURLToPath(import.meta.url));
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `skill-protocol: could not locate repo root (no pnpm-workspace.yaml found walking up from ${start}).`,
      );
    }
    dir = parent;
  }
}
