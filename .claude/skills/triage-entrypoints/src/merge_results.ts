/**
 * Merge per-entry result files from a run's `results/` subdir into its triage state.
 *
 * Each triage-investigator agent writes its verdict to
 * `triage_state/<project>/runs/<run-id>/results/<entry_index>.json` as a
 * `TriageVerdict` (discriminated union). This function scans that directory,
 * validates each file via `parse_triage_verdict`, and flips the corresponding
 * entry's `status` to `"completed"` (or `"failed"` on parse error). Returns
 * the count of entries transitioned.
 *
 * The verdict itself is *not* stored on the entry — `entry.result` is left as
 * `null`. `finalize_triage` re-reads the result files (via
 * `load_verdicts_by_entry_index`) when building the published output, so the
 * verdict ledger lives on disk in `results/` and the triage state is a pure
 * control-plane log of routing + status.
 */

import fs from "fs";
import path from "path";
import { VERDICT_FILE_BASENAME } from "./build_finalization_output.js";
import { parse_triage_verdict } from "./triage_verdict.js";
import type { TriageState } from "./triage_state_types.js";

export function merge_results(state: TriageState, triage_dir: string): number {
  const results_dir = path.join(triage_dir, "results");
  if (!fs.existsSync(results_dir)) return 0;

  const files = fs.readdirSync(results_dir).filter((f) => f.endsWith(".json"));
  let merged = 0;

  for (const file of files) {
    const basename = path.basename(file, ".json");
    // Reuse the finalize-time regex so the absorb and finalize gates never
    // diverge — a verdict marked `completed` here must be loadable there.
    if (!VERDICT_FILE_BASENAME.test(basename)) continue;
    const entry_index = Number.parseInt(basename, 10);

    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (!entry) continue;
    if (entry.status === "completed") continue;

    const file_path = path.join(results_dir, file);
    try {
      const raw = fs.readFileSync(file_path, "utf8");
      parse_triage_verdict(JSON.parse(raw));
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
