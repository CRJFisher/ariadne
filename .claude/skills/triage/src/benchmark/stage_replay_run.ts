/**
 * Stage one benchmark case as a one-entry triage run inside a scratch store, so
 * the unmodified investigator (which fetches its context through
 * `get_entry_context.ts` and writes `results/<entry_index>.json`) replays it
 * exactly as the pipeline would dispatch it. The scratch store is selected for
 * the investigator by `ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE`.
 */

import fs from "node:fs";
import path from "node:path";

import { RESULTS_SUBDIR, RUNS_SUBDIR, TRIAGE_STATE_FILENAME } from "../store/paths.js";
import { state_root } from "../store/store_layout.js";
import type { TriageState } from "../triage_state_types.js";
import { rebase_clone_paths, type BenchmarkCase } from "./load_benchmark_suite.js";

export interface StagedReplay {
  project: string;
  run_id: string;
  entry_index: number;
  verdict_path: string;
}

export function replay_run_id(case_id: string, repeat: number): string {
  return `bench-r${repeat}-${case_id}`;
}

export function stage_replay_run(
  store_dir: string,
  kase: BenchmarkCase,
  repeat: number,
  clone_dir: string,
): StagedReplay {
  const run_id = replay_run_id(kase.case_id, repeat);
  const run_dir = path.join(state_root(store_dir), kase.project, RUNS_SUBDIR, run_id);
  const results_dir = path.join(run_dir, RESULTS_SUBDIR);
  const entry = rebase_clone_paths(kase.entry, kase.project, clone_dir);
  const now = new Date().toISOString();
  const state: TriageState = {
    project_name: kase.project,
    project_path: clone_dir,
    phase: "triage",
    entries: [{ ...entry, status: "pending", result: null, error: null }],
    created_at: now,
    updated_at: now,
  };
  fs.rmSync(results_dir, { recursive: true, force: true });
  fs.mkdirSync(results_dir, { recursive: true });
  fs.writeFileSync(path.join(run_dir, TRIAGE_STATE_FILENAME), JSON.stringify(state, null, 2));
  return {
    project: kase.project,
    run_id,
    entry_index: entry.entry_index,
    verdict_path: path.join(results_dir, `${entry.entry_index}.json`),
  };
}
