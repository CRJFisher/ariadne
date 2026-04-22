import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "./errors.js";
import { SELF_REPAIR_ANALYSIS_OUTPUT_DIR } from "./paths.js";
import type {
  CuratorState,
  ScanOptions,
  ScanResultItem,
} from "./types.js";

/**
 * Snapshot of wip-status group example counts, keyed by group_id.
 * The CLI wrapper computes this from the registry; the pure `scan_runs` function
 * takes it as input so it's trivial to test.
 */
export type WipGroupCounts = Record<string, number>;

interface DiscoveredRun {
  run_id: string;
  project: string;
  run_path: string;
}

/**
 * Walk `analysis_output/{project}/triage_results/*.json` under the given root.
 * Returns runs sorted ASC by run_id (ISO timestamps sort lexically).
 */
export async function discover_runs(
  analysis_output_dir: string = SELF_REPAIR_ANALYSIS_OUTPUT_DIR,
): Promise<DiscoveredRun[]> {
  const runs: DiscoveredRun[] = [];
  let project_dirs: string[];
  try {
    project_dirs = await fs.readdir(analysis_output_dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }

  for (const project of project_dirs) {
    const tr_dir = path.join(analysis_output_dir, project, "triage_results");
    let files: string[];
    try {
      files = await fs.readdir(tr_dir);
    } catch (err) {
      if (error_code(err) === "ENOENT") continue;
      throw err;
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const run_id = file.slice(0, -".json".length);
      runs.push({
        run_id,
        project,
        run_path: path.join(tr_dir, file),
      });
    }
  }

  runs.sort((a, b) => a.run_id.localeCompare(b.run_id));
  return runs;
}

/**
 * Pure: given discovered runs, prior state, wip snapshot, and opts, return
 * the list of runs that need curation (chronological).
 */
export function diff_runs_against_state(
  discovered: DiscoveredRun[],
  state: CuratorState,
  opts: ScanOptions,
  wip_counts: WipGroupCounts,
): ScanResultItem[] {
  const items: ScanResultItem[] = [];

  for (const run of discovered) {
    if (opts.project !== null && run.project !== opts.project) continue;

    const prior = state.curated_runs.find((e) => e.run_id === run.run_id);
    if (prior === undefined) {
      items.push({ ...run, reason: "uncurated", wip_groups_with_growth: [] });
      continue;
    }

    if (!opts.reinvestigate) continue;

    const growth: string[] = [];
    for (const [group_id, current_count] of Object.entries(wip_counts)) {
      const prior_count = prior.outcome.wip_group_example_counts[group_id] ?? 0;
      if (current_count > prior_count) {
        growth.push(group_id);
      }
    }
    if (growth.length > 0) {
      items.push({ ...run, reason: "reinvestigate", wip_groups_with_growth: growth });
    }
  }

  if (opts.last !== null) {
    return items.slice(-opts.last);
  }
  return items;
}

/**
 * Top-level scan: discover runs, honour --run override, apply filters via diff.
 */
export async function scan_runs(
  state: CuratorState,
  opts: ScanOptions,
  wip_counts: WipGroupCounts,
  analysis_output_dir?: string,
): Promise<ScanResultItem[]> {
  if (opts.run !== null) {
    const run_path = path.resolve(opts.run);
    const run_id = path.basename(run_path, ".json");
    const project = path.basename(path.dirname(path.dirname(run_path)));
    return diff_runs_against_state(
      [{ run_id, project, run_path }],
      state,
      opts,
      wip_counts,
    );
  }

  const discovered = await discover_runs(analysis_output_dir);
  return diff_runs_against_state(discovered, state, opts, wip_counts);
}
