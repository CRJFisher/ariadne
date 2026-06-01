/**
 * Read-only access to the published triage_results store.
 *
 * Layout: `analysis_output/<project>/triage_results/<run-id>.json`. These
 * files are kept forever (small, KB-scale) and are the source of truth for
 * cross-run consumers — the TP cache, `diff_runs`, and the triage-curator
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
 * Find the most-recent published `triage_results/<run-id>.json` whose run-id
 * has the given `<short-commit>-` prefix. Returns the parsed output along
 * with the run-id; returns `null` when no matching artifact exists.
 *
 * "Most recent" = lex-max of run-id within the matching commit (ISO timestamp
 * suffix gives chronological order within a commit).
 */
export async function most_recent_finalized_triage_results(
  project: string,
  short_commit: string,
): Promise<{ run_id: string; output: TriageResultsFile } | null> {
  const dir = triage_results_dir(project);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const prefix = `${short_commit}-`;
  const matching = files.filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
  if (matching.length === 0) return null;

  matching.sort();
  const winner = matching[matching.length - 1];
  const winner_path = path.join(dir, winner);
  const text = await fs.readFile(winner_path, "utf-8");
  const output = parse_triage_results(winner_path, text);
  return { run_id: winner.slice(0, -".json".length), output };
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
