/**
 * Merge per-entry result files from triage_state/results/ into the triage state.
 *
 * Each triage-investigator agent writes its result to {triage_dir}/results/{entry_index}.json.
 * This function scans that directory, parses results, and updates the
 * corresponding entries in the state. Returns the count of entries merged.
 */

import fs from "fs";
import path from "path";
import type { TriageState, TriageEntryResult } from "./triage_state_types.js";

export function merge_results(state: TriageState, triage_dir: string): number {
  const results_dir = path.join(triage_dir, "results");
  if (!fs.existsSync(results_dir)) return 0;

  const files = fs.readdirSync(results_dir).filter((f) => f.endsWith(".json"));
  let merged = 0;

  for (const file of files) {
    const basename = path.basename(file, ".json");
    const entry_index = parseInt(basename, 10);
    if (isNaN(entry_index)) continue;

    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (!entry) continue;
    if (entry.status === "completed") continue;

    const file_path = path.join(results_dir, file);
    try {
      const raw = fs.readFileSync(file_path, "utf8");
      const result = JSON.parse(raw) as TriageEntryResult;
      entry.result = result;
      entry.status = "completed";
    } catch (err) {
      entry.status = "failed";
      entry.error = `Failed to parse result file: ${err}`;
    }
    merged++;
  }

  return merged;
}
