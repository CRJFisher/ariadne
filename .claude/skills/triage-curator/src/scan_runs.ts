import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "./errors.js";
import { CURATOR_RUNS_DIR, SELF_REPAIR_ANALYSIS_OUTPUT_DIR } from "./paths.js";
import type { ScanOptions, ScanResultItem } from "./types.js";

/**
 * Walk `analysis_output/{project}/triage_results/*.json` under the given root.
 * Returns runs sorted ASC by run_id (ISO timestamps sort lexically).
 */
export async function discover_runs(
  analysis_output_dir: string = SELF_REPAIR_ANALYSIS_OUTPUT_DIR,
): Promise<ScanResultItem[]> {
  const runs: ScanResultItem[] = [];
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
 * Return the set of run_ids that have been curated (i.e. have a
 * `runs/<id>/finalized.json` sentinel).
 */
export async function list_curated_run_ids(
  runs_dir: string = CURATOR_RUNS_DIR,
): Promise<Set<string>> {
  const out = new Set<string>();
  let entries: string[];
  try {
    entries = await fs.readdir(runs_dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return out;
    throw err;
  }
  for (const run_id of entries) {
    try {
      await fs.access(path.join(runs_dir, run_id, "finalized.json"));
      out.add(run_id);
    } catch (err) {
      if (error_code(err) === "ENOENT") continue;
      throw err;
    }
  }
  return out;
}

/**
 * Pure: given discovered runs and the curated set, return the runs that need
 * curation, honouring --project and --last filters.
 */
export function filter_uncurated(
  discovered: ScanResultItem[],
  curated: Set<string>,
  opts: ScanOptions,
): ScanResultItem[] {
  const items: ScanResultItem[] = [];
  for (const run of discovered) {
    if (opts.project !== null && run.project !== opts.project) continue;
    if (curated.has(run.run_id)) continue;
    items.push(run);
  }
  if (opts.last !== null) {
    return items.slice(-opts.last);
  }
  return items;
}

/**
 * Top-level scan: discover runs, honour --run override, filter by curation state.
 */
export async function scan_runs(
  opts: ScanOptions,
  analysis_output_dir?: string,
  runs_dir?: string,
): Promise<ScanResultItem[]> {
  const curated = await list_curated_run_ids(runs_dir);
  if (opts.run !== null) {
    const run_path = path.resolve(opts.run);
    const run_id = path.basename(run_path, ".json");
    const project = path.basename(path.dirname(path.dirname(run_path)));
    return filter_uncurated([{ run_id, project, run_path }], curated, opts);
  }
  const discovered = await discover_runs(analysis_output_dir);
  return filter_uncurated(discovered, curated, opts);
}
