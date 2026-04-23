import type { TriageState } from "../triage_state_types.js";
import type { GroupInvestigation } from "./types.js";

export interface FinalizationSummary {
  assigned_count: number;
  group_count: number;
}

/**
 * Apply group-investigator verdicts back to the triage state:
 *   - Confirmed members adopt the investigator's canonical `group_id` / `root_cause`.
 *   - Rejected members with a `suggested_group_id` that exists in the confirmed set
 *     move there; everything else lands in `residual-fp`.
 *   - The state's `phase` flips to `"complete"` and `updated_at` is refreshed.
 *
 * Mutates `state` in place and returns a summary for the CLI to print.
 */
export function finalize_aggregation(
  state: TriageState,
  investigations: readonly GroupInvestigation[],
): FinalizationSummary {
  const confirmed_group_ids = new Set(investigations.map((inv) => inv.group_id));
  const entry_by_index = new Map(state.entries.map((e) => [e.entry_index, e]));

  for (const inv of investigations) {
    for (const entry_index of inv.confirmed_members) {
      const entry = entry_by_index.get(entry_index);
      if (!entry || entry.result === null) continue;
      entry.result.group_id = inv.group_id;
      entry.result.root_cause = inv.root_cause;
    }
    for (const rejected of inv.rejected_members) {
      const entry = entry_by_index.get(rejected.entry_index);
      if (!entry || entry.result === null) continue;
      entry.result.group_id = confirmed_group_ids.has(rejected.suggested_group_id)
        ? rejected.suggested_group_id
        : "residual-fp";
    }
  }

  state.phase = "complete";
  state.updated_at = new Date().toISOString();

  const assigned_count = investigations.reduce(
    (sum, inv) => sum + inv.confirmed_members.length + inv.rejected_members.length,
    0,
  );
  return { assigned_count, group_count: investigations.length };
}
