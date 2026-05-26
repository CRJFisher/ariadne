import * as fs from "node:fs/promises";
import * as path from "node:path";

import { atomic_write_file, error_code } from "@ariadnejs/skill-fs";
import { CURATOR_RUNS_DIR } from "./paths.js";
import type { CuratedRunEntry } from "../types.js";

/**
 * Presence of `runs/<id>/finalized.json` is the sole signal that a run has
 * been curated. scan_runs uses this to skip re-curating; finalize writes it
 * at the end. No rolled-up state.json.
 *
 * `finalize_started.json` is the in-progress marker. finalize writes it via
 * `mark_finalize_started` immediately after the sentinel-guard check and
 * before any registry mutation; `save_outcome` clears it once the full
 * sentinel lands. A `finalize_started.json` left behind means a previous run
 * crashed between the registry write and the final sentinel — `is_curated`
 * still returns true so re-runs short-circuit without double-bumping
 * `observed_count`. Human recovery: inspect the registry, decide whether to
 * re-run, then delete both sentinel files.
 *
 * `runs_dir` is injectable so tests can drive a temp directory; production
 * callers pass nothing and the canonical `CURATOR_RUNS_DIR` is used.
 */

function sentinel_path(run_id: string, runs_dir: string): string {
  return path.join(runs_dir, run_id, "finalized.json");
}

function started_marker_path(run_id: string, runs_dir: string): string {
  return path.join(runs_dir, run_id, "finalize_started.json");
}

export async function is_curated(
  run_id: string,
  runs_dir: string = CURATOR_RUNS_DIR,
): Promise<boolean> {
  for (const p of [
    sentinel_path(run_id, runs_dir),
    started_marker_path(run_id, runs_dir),
  ]) {
    try {
      await fs.access(p);
      return true;
    } catch (err) {
      if (error_code(err) === "ENOENT") continue;
      throw err;
    }
  }
  return false;
}

export async function mark_finalize_started(
  run_id: string,
  run_path: string,
  runs_dir: string = CURATOR_RUNS_DIR,
): Promise<void> {
  const out = started_marker_path(run_id, runs_dir);
  await fs.mkdir(path.dirname(out), { recursive: true });
  const stub = {
    run_id,
    run_path,
    started_at: new Date().toISOString(),
  };
  await atomic_write_file(out, JSON.stringify(stub, null, 2) + "\n");
}

export async function save_outcome(
  entry: CuratedRunEntry,
  runs_dir: string = CURATOR_RUNS_DIR,
): Promise<void> {
  const out = sentinel_path(entry.run_id, runs_dir);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await atomic_write_file(out, JSON.stringify(entry, null, 2) + "\n");
  try {
    await fs.unlink(started_marker_path(entry.run_id, runs_dir));
  } catch (err) {
    if (error_code(err) === "ENOENT") return;
    throw err;
  }
}
