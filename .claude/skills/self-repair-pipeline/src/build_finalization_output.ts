/**
 * Convert completed TriageState into finalization output.
 *
 * Partitions entries by binary classification: confirmed-unreachable
 * (ariadne_correct=true) or false-positive groups (ariadne_correct=false).
 *
 * The published artifact is `triage_results/<run-id>.json`. File paths are
 * stored relative to the run's `project_path` so the artifact is portable
 * across machines and worktrees, and so the TP cache match key is stable.
 */

import path from "path";

import type { FalsePositiveEntry, FalsePositiveGroup } from "@ariadnejs/types";
import type { TriageState, TriageEntry } from "./triage_state_types.js";

export const FINALIZATION_OUTPUT_SCHEMA_VERSION = 2;

// ===== Output Types =====

export interface FinalizationOutput {
  schema_version: number;
  /**
   * Absolute path to the target repo at run time. Consumers (curator, diff_runs)
   * resolve `file_path` against this to read source. Travels with the run-id and
   * the commit_hash to make the artifact self-contained.
   */
  project_path: string;
  /** Full HEAD commit hash for the target repo at run time, or `null` for non-git projects. */
  commit_hash: string | null;
  confirmed_unreachable: FalsePositiveEntry[];
  false_positive_groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}

export interface FinalizationContext {
  /** HEAD commit hash recorded for provenance. May be null for non-git projects. */
  commit_hash: string | null;
  /** Absolute project path. Used to relativize entry `file_path` values and published verbatim. */
  project_path: string;
}

export interface FinalizationSummary {
  total_entries: number;
  confirmed_unreachable_count: number;
  false_positive_count: number;
  group_count: number;
  failed_count: number;
}

// ===== Pure Functions =====

function relativize(file_path: string, project_path: string): string {
  if (!path.isAbsolute(file_path)) return file_path;
  return path.relative(project_path, file_path);
}

function entry_to_fp_entry(entry: TriageEntry, project_path: string): FalsePositiveEntry {
  if (entry.kind !== "function" && entry.kind !== "method" && entry.kind !== "constructor") {
    throw new Error(
      `entry_to_fp_entry: unexpected kind "${entry.kind}" for ${entry.name} (${entry.file_path})`,
    );
  }
  const result: FalsePositiveEntry = {
    name: entry.name,
    file_path: relativize(entry.file_path, project_path),
    start_line: entry.start_line,
    kind: entry.kind,
  };
  if (entry.signature !== null) {
    result.signature = entry.signature;
  }
  return result;
}

export function build_finalization_output(
  state: TriageState,
  context: FinalizationContext,
): FinalizationOutput {
  const confirmed_unreachable: FalsePositiveEntry[] = [];
  const false_positive_groups: Record<string, FalsePositiveGroup> = {};

  for (const entry of state.entries) {
    if (entry.status === "failed" || entry.result === null) {
      continue;
    }

    const result = entry.result;

    if (result.ariadne_correct) {
      confirmed_unreachable.push(entry_to_fp_entry(entry, context.project_path));
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
      false_positive_groups[group_id].entries.push(
        entry_to_fp_entry(entry, context.project_path),
      );
    }
  }

  return {
    schema_version: FINALIZATION_OUTPUT_SCHEMA_VERSION,
    project_path: context.project_path,
    commit_hash: context.commit_hash,
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
