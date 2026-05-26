/**
 * Merge per-entry result files from a run's `results/` subdir into its triage state.
 *
 * Each triage-investigator agent writes its verdict to
 * `triage_state/<project>/runs/<run-id>/results/<entry_index>.json` as a
 * `TriageVerdict` (discriminated union). This function delegates the
 * directory listing + per-file parse to `verdict_ledger` so the absorb-time
 * and finalize-time gates cannot diverge, then flips the corresponding
 * entry's `status` to `"completed"` (or `"failed"` on parse error). Returns
 * the count of entries transitioned.
 *
 * The verdict itself is *not* stored on the entry — `entry.result` is left as
 * `null`. `finalize_triage` re-reads the result files (via
 * `load_verdicts_by_entry_index`) when building the published output, so the
 * verdict ledger lives on disk in `results/` and the triage state is a pure
 * control-plane log of routing + status.
 */

import path from "node:path";

import { list_verdict_files, read_verdict_file } from "./verdict_ledger.js";
import type { TriageState } from "../triage_state_types.js";

export async function merge_results(state: TriageState, triage_dir: string): Promise<number> {
  const results_dir = path.join(triage_dir, "results");
  const files = await list_verdict_files(results_dir);
  let merged = 0;

  for (const { entry_index, file_path } of files) {
    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (!entry) continue;
    if (entry.status === "completed") continue;

    try {
      await read_verdict_file(file_path);
      entry.result = null;
      entry.status = "completed";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      entry.status = "failed";
      entry.error = `Failed to parse verdict file: ${message}`;
    }
    merged++;
  }

  return merged;
}
