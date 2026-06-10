/**
 * Read-only access to the published triage_results store.
 *
 * Layout: `analysis_output/<project>/triage_results/<run-id>.json`. These
 * files are kept forever (small, KB-scale) and are the source of truth for
 * cross-run consumers — the TP cache, `diff_runs`, and the plan
 * skill. They survive `prune_runs`, which only deletes per-run scratch state
 * under `triage_state/<project>/runs/<run-id>/`.
 *
 * This module owns the shape and lookup of the published store. Run-state
 * discovery (manifests, active runs) lives in `run_discovery.ts` instead.
 */

import * as fs from "node:fs/promises";
import path from "path";

import {
  parse_triage_results,
  triage_results_dir,
  triage_results_path,
  type TriageResultsFile,
} from "@ariadnejs/skill-protocol";

/**
 * Return all published triage_results runs whose run-id has the given
 * `<short-commit>-` prefix, sorted lexicographically descending (newest first).
 * Returns an empty array when no matching artifacts exist.
 */
export async function all_finalized_runs_at_commit(
  project: string,
  short_commit: string,
): Promise<{ run_id: string; output: TriageResultsFile }[]> {
  const dir = triage_results_dir(project);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const prefix = `${short_commit}-`;
  const matching = files
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (matching.length === 0) return [];

  const results: { run_id: string; output: TriageResultsFile }[] = [];
  for (const file of matching) {
    const run_id = file.slice(0, -".json".length);
    const file_path = path.join(dir, file);
    const text = await fs.readFile(file_path, "utf-8");
    const output = parse_triage_results(file_path, text);
    results.push({ run_id, output });
  }
  return results;
}

/**
 * Read a specific published triage_results file by run-id. Throws on missing.
 */
export async function read_triage_results(
  project: string,
  run_id: string,
): Promise<TriageResultsFile> {
  const file = triage_results_path(project, run_id);
  const text = await fs.readFile(file, "utf-8");
  return parse_triage_results(file, text);
}
