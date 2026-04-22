// ===== Triage results shape (read-only, mirrors self-repair-pipeline canonical output) =====

export interface FalsePositiveEntry {
  name: string;
  file_path: string;
  start_line: number;
  signature?: string;
}

export interface FalsePositiveGroup {
  group_id: string;
  root_cause: string;
  reasoning: string;
  existing_task_fixes: string[];
  entries: FalsePositiveEntry[];
}

export interface TriageResultsFile {
  confirmed_unreachable: FalsePositiveEntry[];
  false_positive_groups: Record<string, FalsePositiveGroup>;
  last_updated: string;
}

// ===== Known-issues registry shape (read/write) =====

export type KnownIssueStatus = "permanent" | "wip" | "fixed";

export interface KnownIssueExample {
  file: string;
  line: number;
  snippet: string;
}

export interface KnownIssue {
  group_id: string;
  title: string;
  description: string;
  status: KnownIssueStatus;
  languages: string[];
  backlog_task?: string;
  examples: KnownIssueExample[];
  classifier: unknown; // opaque to the curator; self-repair-pipeline is authoritative for validation
  observed_count?: number;
  observed_projects?: string[];
  last_seen_run?: string;
  /** Curator-populated tag indicating the classifier is producing too many outliers. */
  drift_detected?: boolean;
}

// ===== Curator state =====

export interface CurationOutcome {
  qa_groups_checked: number;
  qa_outliers_found: number;
  investigated_groups: number;
  classifiers_proposed: number;
  backlog_tasks_proposed: string[];
  /** Snapshot of wip-status group example counts at curation time, keyed by group_id. */
  wip_group_example_counts: Record<string, number>;
  /** Count of investigator sessions that produced a valid classifier. */
  success_count: number;
  /** Count of investigator sessions where classification was structurally impossible. */
  failure_count: number;
  /** Count of investigator sessions blocked on a missing-signal gap. */
  blocked_count: number;
  /** Per-group failure detail for sessions with status "failure". */
  failed_groups: Array<{
    group_id: string;
    failure_category: InvestigatorFailureCategory;
    failure_details: string;
  }>;
}

export interface CuratedRunEntry {
  run_id: string;
  project: string;
  run_path: string;
  curated_at: string;
  outcome: CurationOutcome;
}

export interface CuratorState {
  curated_runs: CuratedRunEntry[];
}

// ===== Scan =====

export interface ScanOptions {
  project: string | null;
  last: number | null;
  run: string | null;
  reinvestigate: boolean;
}

export interface ScanResultItem {
  run_id: string;
  project: string;
  run_path: string;
  reason: "uncurated" | "reinvestigate";
  wip_groups_with_growth: string[];
}

// ===== Sub-agent output shapes =====

export interface QaOutlier {
  entry_index: number;
  reason: string;
}

export interface QaResponse {
  group_id: string;
  outliers: QaOutlier[];
  notes: string;
}

export type ClassifierAxis = "A" | "B" | "C";

/**
 * Proposal from the investigator. Normalised shapes (mirrors the authoritative
 * `ClassifierSpec` in self-repair-pipeline):
 *   { kind: "none" }
 *   { kind: "builtin";   function_name; min_confidence }
 *   { kind: "predicate"; axis; expression; min_confidence }
 */
export type ClassifierSpecProposal =
  | { kind: "none" }
  | { kind: "builtin"; function_name: string; min_confidence: number }
  | { kind: "predicate"; axis: ClassifierAxis; expression: unknown; min_confidence: number };

export interface BacklogRefProposal {
  title: string;
  description: string;
}

// ===== Builtin classifier spec =====
//
// Emitted by the investigator when `proposed_classifier.kind === "builtin"`.
// The main agent consumes it in Step 4.5 (via `render_classifier`) to author
// the `.ts` source file at the pre-assigned path. The union is closed — every
// op is enumerated in both the type and the renderer's translation table.
// Adding a new op requires a change in both places; the main agent never
// emits free-form code.

export type SignalCheck =
  // ===== predicate-DSL-expressible ops (reusable in builtin context) =====
  | { op: "diagnosis_eq"; value: string }
  | { op: "language_eq"; value: "typescript" | "javascript" | "python" | "rust" }
  | { op: "syntactic_feature_eq"; name: string; value: string | number | boolean }
  | { op: "grep_line_regex"; pattern: string }
  | { op: "decorator_matches"; pattern: string }
  | { op: "has_capture_at_grep_hit"; capture_name: string }
  | { op: "missing_capture_at_grep_hit"; capture_name: string }
  | { op: "receiver_kind_eq"; value: string }
  | { op: "resolution_failure_reason_eq"; value: string }
  // ===== ops requiring cross-file access (why builtin, not predicate) =====
  | { op: "callers_count_at_least"; n: number }
  | { op: "callers_count_at_most"; n: number }
  | { op: "file_path_matches"; pattern: string }
  | { op: "name_matches"; pattern: string };

/** String-form enumeration of `SignalCheck.op` values. Kept in sync with the union above. */
export const SIGNAL_CHECK_OPS: readonly string[] = [
  "diagnosis_eq",
  "language_eq",
  "syntactic_feature_eq",
  "grep_line_regex",
  "decorator_matches",
  "has_capture_at_grep_hit",
  "missing_capture_at_grep_hit",
  "receiver_kind_eq",
  "resolution_failure_reason_eq",
  "callers_count_at_least",
  "callers_count_at_most",
  "file_path_matches",
  "name_matches",
];

export interface BuiltinClassifierSpec {
  function_name: string;
  min_confidence: number;
  combinator: "all" | "any";
  checks: SignalCheck[];
  /**
   * Entry indexes from the group's `entries[]` array that the classifier is
   * designed to match. Validated by the dispatcher against `group.entries.length`.
   */
  positive_examples: number[];
  /**
   * Entry indexes from the group's `entries[]` array (typically QA outliers in
   * promoted mode) that the classifier must NOT match.
   */
  negative_examples: number[];
  /** Copied into the generated file header and the commit-message body. */
  description: string;
}

export interface InvestigateResponse {
  group_id: string;
  proposed_classifier: ClassifierSpecProposal | null;
  backlog_ref: BacklogRefProposal | null;
  new_signals_needed: string[];
  /**
   * Required when `proposed_classifier.kind === "builtin"`; null otherwise.
   * The main agent renders the spec to TypeScript source in Step 4.5.
   */
  classifier_spec: BuiltinClassifierSpec | null;
  reasoning: string;
}

// ===== Investigator session log =====

export type InvestigatorSessionStatus = "success" | "failure" | "blocked_missing_signal";

/**
 * Why the investigator could not produce a working classifier. Only populated when
 * status is "failure".
 *
 * - `group_incoherent`      the FalsePositiveGroup mixes unrelated root causes
 * - `pattern_unclear`       single pattern, but discriminating signals unclear
 * - `classifier_infeasible` pattern understood, no DSL/builtin can express it
 * - `registry_conflict`     another registry entry already claims these members
 * - `permanent_locked`      promoted group's existing entry is status: "permanent"
 * - `other`                 anything else; details field must explain
 */
export type InvestigatorFailureCategory =
  | "group_incoherent"
  | "pattern_unclear"
  | "classifier_infeasible"
  | "registry_conflict"
  | "permanent_locked"
  | "other";

export interface InvestigatorSessionActions {
  classifier_kind: "predicate" | "builtin" | "none" | null;
  backlog_ref_emitted: boolean;
  new_signals_needed_count: number;
  /** True when the investigator emitted a `BuiltinClassifierSpec`. Only meaningful when classifier_kind === "builtin". */
  classifier_spec_emitted: boolean;
}

export interface InvestigatorSessionLog {
  group_id: string;
  mode: "residual" | "promoted";
  status: InvestigatorSessionStatus;
  /**
   * Full narrative. On failure, cite specific files/lines/patterns examined and why
   * no classifier could be produced. On success, describe which signals discriminate
   * the pattern and which kind of classifier was chosen.
   */
  reasoning: string;
  failure_category: InvestigatorFailureCategory | null;
  /**
   * Concrete specifics beyond reasoning — e.g. "entries 3, 7, 12 are TypeScript
   * reflection; entries 1, 2, 5 are re-exports; the group was mis-aggregated upstream."
   * Required when status is "failure".
   */
  failure_details: string | null;
  /** Populated on success or blocked_missing_signal. */
  success_summary: string | null;
  actions: InvestigatorSessionActions;
  entries_examined_count: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}
