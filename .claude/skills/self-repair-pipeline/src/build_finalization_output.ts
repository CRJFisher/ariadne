/**
 * Convert completed TriageState into finalization output.
 *
 * Partitions entries by binary classification: confirmed-unreachable
 * (ariadne_correct=true) or false-positive groups (ariadne_correct=false).
 */

import type { FalsePositiveEntry, FalsePositiveGroup } from "./entry_point_types.js";
import type { TriageState, TriageEntry } from "./triage_state_types.js";

// ===== Output Types =====

export interface FinalizationOutput {
  confirmed_unreachable: FalsePositiveEntry[];
  false_positive_groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}

export interface FinalizationSummary {
  total_entries: number;
  confirmed_unreachable_count: number;
  false_positive_count: number;
  group_count: number;
  failed_count: number;
}

// ===== Pure Functions =====

function entry_to_fp_entry(entry: TriageEntry): FalsePositiveEntry {
  const result: FalsePositiveEntry = {
    name: entry.name,
    file_path: entry.file_path,
    start_line: entry.start_line,
  };
  if (entry.signature !== null) {
    result.signature = entry.signature;
  }
  return result;
}

export function build_finalization_output(state: TriageState): FinalizationOutput {
  const confirmed_unreachable: FalsePositiveEntry[] = [];
  const false_positive_groups: Record<string, FalsePositiveGroup> = {};

  for (const entry of state.entries) {
    if (entry.status === "failed" || entry.result === null) {
      continue;
    }

    const result = entry.result;

    if (result.ariadne_correct) {
      confirmed_unreachable.push(entry_to_fp_entry(entry));
    } else {
      const group_id = result.group_id;
      if (!(group_id in false_positive_groups)) {
        false_positive_groups[group_id] = {
          group_id,
          root_cause: result.root_cause,
          reasoning: result.reasoning,
          existing_task_fixes: [],
          entries: [],
        };
      }
      false_positive_groups[group_id].entries.push(entry_to_fp_entry(entry));
    }
  }

  return {
    confirmed_unreachable,
    false_positive_groups,
    last_updated: state.updated_at,
  };
}

export function build_finalization_summary(
  state: TriageState,
  output: FinalizationOutput,
): FinalizationSummary {
  const false_positive_count = Object.values(output.false_positive_groups)
    .reduce((sum, g) => sum + g.entries.length, 0);

  const failed_count = state.entries
    .filter(e => e.status === "failed" || (e.status === "completed" && e.result === null))
    .length;

  return {
    total_entries: state.entries.length,
    confirmed_unreachable_count: output.confirmed_unreachable.length,
    false_positive_count,
    group_count: Object.keys(output.false_positive_groups).length,
    failed_count,
  };
}
