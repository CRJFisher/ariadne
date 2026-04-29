/**
 * Triage-results shapes published in
 * `analysis_output/<project>/triage_results/<run-id>.json`.
 *
 * Records here are **post-classification**: each entry is either a confirmed
 * unreachable function or a member of a false-positive group with a known
 * root cause.
 *
 * `file_path` on every record is **relative** to the run's `project_path` so
 * the JSON artifact is portable across machines and worktrees.
 */

/**
 * A single false-positive (or confirmed-unreachable) entry point published in
 * the triage results JSON.
 */
export interface FalsePositiveEntry {
  name: string;
  /** Relative to the run's project_path. */
  file_path: string;
  start_line: number;
  /** Definition kind. Required so the TP cache match key disambiguates same-name overloads. */
  kind: "function" | "method" | "constructor";
  signature?: string;
}

/**
 * A group of false-positive detections sharing the same root cause.
 * Multiple entry points can be grouped together when they share the same root
 * cause and fix strategy.
 */
export interface FalsePositiveGroup {
  /** Kebab-case short identifier (e.g., "builder-method-chain"). */
  group_id: string;
  /** Full description of the root cause. */
  root_cause: string;
  /** Explanation of why this causes false positives. */
  reasoning: string;
  /** Related backlog tasks. */
  existing_task_fixes: string[];
  entries: FalsePositiveEntry[];
}

/** The full triage-results file structure. */
export interface FalsePositiveTriageResults {
  /** Keyed by group_id for easy lookup. */
  groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}
