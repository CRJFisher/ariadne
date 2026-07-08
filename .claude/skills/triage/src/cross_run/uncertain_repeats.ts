/**
 * Cross-run uncertain-repeat counter.
 *
 * An `uncertain` verdict is the investigator's abstain: it never enters the TP
 * cache, so the same entry is re-investigated on every run — unbounded spend
 * with no operator-facing signal. This counts how many of the recent published
 * runs each uncertain entry recurs in (by the line-drift-tolerant `fuzzy_key`,
 * shared with `diff_runs`), so a persistently-uncertain entry surfaces as a
 * human signal to resolve or exclude it. It is NOT fed into any automatic
 * decision — plan deliberately does not consume `uncertain` — it is reporting
 * only.
 */

import type { TriageResultsFile, PublishedUncertain } from "@ariadnejs/skill-protocol";

import { fuzzy_key } from "./diff_runs.js";

export interface UncertainRepeat {
  name: string;
  file_path: string;
  kind: string;
  /** The most recent run's `start_line` (runs are consumed newest-first). */
  start_line: number;
  /** How many of the provided runs flagged this entry `uncertain`. */
  run_count: number;
}

/**
 * Count uncertain-entry recurrences across `runs` (passed NEWEST-FIRST). Each
 * run contributes at most one to a key's `run_count` (a run listing the same
 * fuzzy identity twice still counts once). The newest run's row supplies the
 * display fields, since it is seen first. Sorted by `run_count` descending, then
 * by `file_path`/`name` for stable output.
 */
export function count_uncertain_repeats(runs: TriageResultsFile[]): UncertainRepeat[] {
  const by_key = new Map<string, { entry: PublishedUncertain; run_count: number }>();
  for (const run of runs) {
    const seen_this_run = new Set<string>();
    for (const u of run.uncertain) {
      const key = fuzzy_key(u);
      if (seen_this_run.has(key)) continue;
      seen_this_run.add(key);
      const existing = by_key.get(key);
      if (existing === undefined) by_key.set(key, { entry: u, run_count: 1 });
      else existing.run_count += 1;
    }
  }
  return [...by_key.values()]
    .map(({ entry, run_count }) => ({
      name: entry.name,
      file_path: entry.file_path,
      kind: entry.kind,
      start_line: entry.start_line,
      run_count,
    }))
    .sort(
      (a, b) =>
        b.run_count - a.run_count ||
        a.file_path.localeCompare(b.file_path) ||
        a.name.localeCompare(b.name),
    );
}
