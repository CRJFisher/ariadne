/**
 * Finalize a drained run: build the published v5 results from the per-entry
 * verdict files, write them, seal the manifest, and clear the project's LATEST
 * pointer.
 *
 * The published `novel_issues[]` (one per `fp-novel` verdict) and
 * `classifier_regressions[]` (rolled up from `fp-classifier-regression`
 * verdicts) are derived from the verdict files under `results/`, the single
 * source of truth. The run directory itself is preserved for diffing and audit;
 * `prune_runs.ts` is the only script that deletes run dirs.
 */

import * as fs from "node:fs/promises";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import { triage_results_dir, triage_results_path } from "@ariadnejs/skill-protocol";

import { compute_tp_stability } from "./confirmed_unreachable_reuse.js";
import { build_finalization_output, build_finalization_summary, type FinalizationSummary } from "./output.js";
import { load_verdicts_by_entry_index } from "./verdict_ledger.js";
import { clear_latest } from "../store/latest_pointer.js";
import { require_run, results_dir_for } from "../store/paths.js";
import type { RunManifest, TpStability, TriageState } from "../triage_state_types.js";

export interface FinalizedRun {
  output_file: string;
  summary: FinalizationSummary;
  tp_cache_stability: TpStability | null;
}

async function load_json<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(file, "utf-8")) as T;
}

export async function finalize_run(project: string, run_id: string): Promise<FinalizedRun> {
  const { state_path, manifest_path } = require_run(project, run_id);
  const state = await load_json<TriageState>(state_path);
  if (state.phase !== "complete") {
    throw new Error(`run ${run_id} is in phase "${state.phase}"; it finalizes only once complete`);
  }

  const manifest = await load_json<RunManifest>(manifest_path);
  if (manifest.status === "finalized") {
    throw new Error(
      `run ${run_id} was already finalized at ${manifest.finalized_at}; refusing to overwrite the published triage_results artifact`,
    );
  }

  const verdicts_by_entry_index = await load_verdicts_by_entry_index(results_dir_for(project, run_id));
  const output = build_finalization_output(state, {
    commit_hash: manifest.commit_hash,
    project_path: state.project_path,
    sources: { verdicts_by_entry_index },
  });

  // The published file is the permanent source of truth for the TP cache,
  // diff_runs and the plan skill, so it is written atomically.
  await fs.mkdir(triage_results_dir(state.project_name), { recursive: true });
  const output_file = triage_results_path(state.project_name, run_id);
  await atomic_write_file(output_file, JSON.stringify(output, null, 2) + "\n");

  manifest.tp_cache.stability = compute_tp_stability(state, verdicts_by_entry_index);
  manifest.status = "finalized";
  manifest.finalized_at = new Date().toISOString();
  await atomic_write_file(manifest_path, JSON.stringify(manifest, null, 2) + "\n");

  // LATEST is cleared after the manifest is sealed, so a crash between the two
  // leaves the run still discoverable through the pointer.
  clear_latest(project);

  return { output_file, summary: build_finalization_summary(state, output), tp_cache_stability: manifest.tp_cache.stability };
}
