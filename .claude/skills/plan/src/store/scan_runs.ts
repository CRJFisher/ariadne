import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "@ariadnejs/skill-fs";
import {
  analysis_output_dir,
  is_run_id,
  parse_triage_results_path,
} from "@ariadnejs/skill-protocol";
import type { ScanOptions, ScanResultItem } from "../types.js";

/**
 * Walk `analysis_output/{project}/triage_results/*.json` under the given root.
 * Files whose name is not a well-formed run-id are skipped (legacy or partial
 * writes never abort the sweep). Returns runs sorted ASC by run_id (ISO
 * timestamps sort lexically within a commit).
 */
export async function discover_runs(
  root_dir: string = analysis_output_dir(),
): Promise<ScanResultItem[]> {
  const runs: ScanResultItem[] = [];
  let project_dirs: string[];
  try {
    project_dirs = await fs.readdir(root_dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }

  for (const project of project_dirs) {
    const tr_dir = path.join(root_dir, project, "triage_results");
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
      if (!is_run_id(run_id)) continue;
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
 * Pure: given discovered runs, return those a sweep should process, honouring
 * the --project and --last filters. Idempotency is not a concern here — the
 * reconcile pass dedups by `dedup_key`, so re-feeding an already-swept run
 * augments its task rather than duplicating work.
 */
export function apply_scan_filters(
  discovered: ScanResultItem[],
  opts: ScanOptions,
): ScanResultItem[] {
  const items: ScanResultItem[] = [];
  for (const run of discovered) {
    if (opts.project !== null && run.project !== opts.project) continue;
    items.push(run);
  }
  if (opts.last !== null) {
    return items.slice(-opts.last);
  }
  return items;
}

/**
 * Top-level scan: discover runs, honour --run override, apply --project/--last.
 */
export async function scan_runs(
  opts: ScanOptions,
  root_dir?: string,
): Promise<ScanResultItem[]> {
  if (opts.run !== null) {
    const run_path = path.resolve(opts.run);
    const { project, run_id } = parse_triage_results_path(run_path);
    return apply_scan_filters([{ run_id, project, run_path }], opts);
  }
  const discovered = await discover_runs(root_dir);
  return apply_scan_filters(discovered, opts);
}
