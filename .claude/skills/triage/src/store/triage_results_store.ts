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
import type { Dirent } from "node:fs";

import {
  analysis_output_dir,
  parse_triage_results,
  triage_results_dir,
  triage_results_path,
  type TriageResultsFile,
} from "@ariadnejs/skill-protocol";

/**
 * Return all run-ids at the given `<short-commit>-` prefix, sorted
 * lexicographically descending (newest first).
 * Returns an empty array when no matching artifacts exist.
 */
export async function all_finalized_runs_at_commit(
  project: string,
  short_commit: string,
): Promise<string[]> {
  const dir = triage_results_dir(project);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }

  const prefix = `${short_commit}-`;
  return files
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .reverse()
    .map((f) => f.slice(0, -".json".length));
}

/**
 * Return every published run-id for a project, **wall-clock newest-first**.
 * Unlike {@link all_finalized_runs_at_commit} this spans commits, for cross-run
 * signals (e.g. uncertain-repeat counting) that track an entry across target-repo
 * edits — so ordering must be by TIME, not by run-id lexicographically. A run-id
 * is `<short-commit>-<iso-timestamp>`, and the leading commit hex is unrelated to
 * time; a whole-id sort would interleave commits by hex prefix. This sorts on the
 * ISO-timestamp suffix (everything after the first `-`), which is lexicographic-
 * ally monotonic in time. Empty when the project has no published results.
 */
export async function all_finalized_run_ids(project: string): Promise<string[]> {
  const dir = triage_results_dir(project);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const timestamp_suffix = (run_id: string): string => run_id.slice(run_id.indexOf("-") + 1);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort((a, b) => timestamp_suffix(b).localeCompare(timestamp_suffix(a)));
}

/**
 * List every project directory under `analysis_output/` that has a
 * `triage_results/` subdir. Sorted. Empty when nothing has been published yet.
 */
export async function list_projects_with_results(): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(analysis_output_dir(), { withFileTypes: true });
  } catch {
    return [];
  }
  const projects: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(triage_results_dir(entry.name));
      projects.push(entry.name);
    } catch {
      // No triage_results subdir — not a published-results project.
    }
  }
  return projects.sort();
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
