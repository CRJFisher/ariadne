/**
 * Convert completed TriageState into finalization output.
 *
 * Partitions entries by classification (true positive, dead code,
 * false positive group) and builds the canonical output shape for
 * save_json and registry updates.
 */

import type { FalsePositiveEntry, FalsePositiveGroup } from "./types.js";
import type { TriageState, TriageEntry } from "./triage_state_types.js";

// ===== Output Types =====

export interface FinalizationOutput {
  true_positives: FalsePositiveEntry[];
  dead_code: FalsePositiveEntry[];
  groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}

export interface FinalizationSummary {
  total_entries: number;
  true_positive_count: number;
  dead_code_count: number;
  false_positive_count: number;
  group_count: number;
  failed_count: number;
  task_files: string[];
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
  const true_positives: FalsePositiveEntry[] = [];
  const dead_code: FalsePositiveEntry[] = [];
  const groups: Record<string, FalsePositiveGroup> = {};

  for (const entry of state.entries) {
    if (entry.status === "failed" || entry.result === null) {
      continue;
    }

    const result = entry.result;

    if (result.is_true_positive) {
      true_positives.push(entry_to_fp_entry(entry));
    } else if (result.is_likely_dead_code) {
      dead_code.push(entry_to_fp_entry(entry));
    } else {
      const group_id = result.group_id;
      if (!(group_id in groups)) {
        const task_file = state.fix_planning?.groups[group_id]?.task_file ?? null;
        groups[group_id] = {
          group_id,
          root_cause: result.root_cause,
          reasoning: result.reasoning,
          existing_task_fixes: task_file ? [task_file] : [],
          entries: [],
        };
      }
      groups[group_id].entries.push(entry_to_fp_entry(entry));
    }
  }

  return {
    true_positives,
    dead_code,
    groups,
    last_updated: state.updated_at,
  };
}

export function build_finalization_summary(
  state: TriageState,
  output: FinalizationOutput,
): FinalizationSummary {
  const false_positive_count = Object.values(output.groups)
    .reduce((sum, g) => sum + g.entries.length, 0);

  const failed_count = state.entries
    .filter(e => e.status === "failed" || (e.status === "completed" && e.result === null))
    .length;

  const task_files = Object.values(output.groups)
    .flatMap(g => g.existing_task_fixes);

  return {
    total_entries: state.entries.length,
    true_positive_count: output.true_positives.length,
    dead_code_count: output.dead_code.length,
    false_positive_count,
    group_count: Object.keys(output.groups).length,
    failed_count,
    task_files,
  };
}
