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

export const FINALIZATION_OUTPUT_SCHEMA_VERSION = 3;

// ===== Output Types =====

/**
 * Per-run match accounting for one registry group_id. Preserved through
 * finalization so downstream tooling (curator's promotion-candidate scoring,
 * fix-sequencer's diff_runs) can compute cross-run firing statistics. Without
 * this, rule attribution would be discarded at the boundary.
 */
export interface GroupMatchHistory {
  group_id: string;
  /**
   * Entries auto-suppressed by this rule's predicate/builtin classifier in
   * this run. Equals the count of TriageEntry rows where
   * `auto_classified === true` and `known_source === "registry:<group_id>"`.
   */
  match_count: number;
  /**
   * Entries the LLM independently attributed to this group_id (route
   * "llm-triage", non-auto-classified, `result.ariadne_correct === false`,
   * `result.group_id` matching). Cross-verification signal: how often the LLM
   * agrees with the classifier's group attribution on entries the classifier
   * did NOT auto-suppress.
   */
  llm_attributed_count: number;
}

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
  group_match_history: GroupMatchHistory[];
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

const REGISTRY_KNOWN_SOURCE_PREFIX = "registry:";

function registry_group_id_from_source(known_source: string | null): string | null {
  if (known_source === null) return null;
  if (!known_source.startsWith(REGISTRY_KNOWN_SOURCE_PREFIX)) return null;
  return known_source.slice(REGISTRY_KNOWN_SOURCE_PREFIX.length);
}

function build_group_match_history(state: TriageState): GroupMatchHistory[] {
  const by_group = new Map<string, GroupMatchHistory>();
  const get = (group_id: string): GroupMatchHistory => {
    let row = by_group.get(group_id);
    if (row === undefined) {
      row = { group_id, match_count: 0, llm_attributed_count: 0 };
      by_group.set(group_id, row);
    }
    return row;
  };
  for (const entry of state.entries) {
    if (entry.auto_classified) {
      const group_id = registry_group_id_from_source(entry.known_source);
      if (group_id !== null) get(group_id).match_count += 1;
      continue;
    }
    if (entry.status !== "completed" || entry.result === null) continue;
    if (entry.result.ariadne_correct) continue;
    if (entry.result.group_id === "confirmed-unreachable") continue;
    get(entry.result.group_id).llm_attributed_count += 1;
  }
  return [...by_group.values()].sort((a, b) => a.group_id.localeCompare(b.group_id));
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
    group_match_history: build_group_match_history(state),
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
