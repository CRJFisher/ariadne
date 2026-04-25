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

/**
 * Closed enum mirroring `self-repair-pipeline/src/known_issues_types.ts`.
 * The canonical source for validation lives in self-repair-pipeline; this copy
 * is used to type derived language lists on the curator side so authored
 * upserts can't drift from the four supported targets.
 */
export type KnownIssueLanguage = "typescript" | "javascript" | "python" | "rust";

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
  /** Curator-populated tag indicating the classifier is producing too many outliers. */
  drift_detected?: boolean;
  /** Cumulative count of false-positive entries observed across curated runs. */
  observed_count?: number;
  /** Project names in which this group has been observed at least once. */
  observed_projects?: string[];
  /** Run id of the most recent run that observed this group. */
  last_seen_run?: string;
}

// ===== Curator state (per-run sentinel files under runs/<id>/finalized.json) =====

export interface CurationOutcome {
  qa_groups_checked: number;
  qa_outliers_found: number;
  investigated_groups: number;
  classifiers_proposed: number;
  /**
   * Introspection-gap sub-tasks proposed for `INTROSPECTION_GAP_PARENT_TASK_ID`.
   * Persisted in full so Step 6a is replayable from the sentinel if the main
   * agent crashes between finalize and backlog filing.
   */
  introspection_gap_tasks: IntrospectionGapTaskToCreate[];
  /**
   * Ariadne-bug top-level tasks proposed. Persisted in full so Step 6b is
   * replayable from the sentinel; crash between finalize and
   * `link_ariadne_bug_tasks` does not strand registry entries.
   */
  ariadne_bug_tasks: AriadneBugTaskToCreate[];
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

// ===== Scan =====

export interface ScanOptions {
  project: string | null;
  last: number | null;
  run: string | null;
}

export interface ScanResultItem {
  run_id: string;
  project: string;
  run_path: string;
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

/**
 * Curator-emitted classifier shape. Mirrors `ClassifierSpec` in self-repair-pipeline
 * but narrowed: the curator only emits "none" (retire) or "builtin" (author source).
 * Hand-authored predicate classifiers exist in the registry but are not produced here.
 */
export type ClassifierSpecProposal =
  | { kind: "none" }
  | { kind: "builtin"; function_name: string; min_confidence: number };

/**
 * Closed enumeration of the resolver-level root causes behind a false-positive
 * group. Used to label Ariadne-bug backlog tasks so they can be rolled up by
 * category in impact reports.
 *
 * - `receiver_resolution`     member-access receiver type lost across a field or
 *                             method hop (e.g. `project.definitions.method()`).
 * - `import_resolution`       import-level linking failure (inline `require()`,
 *                             wildcard imports, re-export chains, module-qualified
 *                             attribute calls).
 * - `syntactic_extraction`    the tree-sitter query / definition extractor does not
 *                             capture the node kind (e.g. JS getter/setter, class
 *                             extends, Rust enum-impl methods).
 * - `coverage_config`         call sites exist but live in files Ariadne excludes
 *                             from indexing (e.g. `/tests/` directories).
 * - `cross_file_flow`         call edge requires flow through a value (argument
 *                             lambdas through higher-order calls, object-literal
 *                             method through destructure, factory return types).
 * - `other`                   anything else; description must explain.
 */
export type AriadneRootCauseCategory =
  | "receiver_resolution"
  | "import_resolution"
  | "syntactic_extraction"
  | "coverage_config"
  | "cross_file_flow"
  | "other";

/** String-form enumeration of `AriadneRootCauseCategory`. Kept in sync with the union above. */
export const ARIADNE_ROOT_CAUSE_CATEGORIES: readonly AriadneRootCauseCategory[] = [
  "receiver_resolution",
  "import_resolution",
  "syntactic_extraction",
  "coverage_config",
  "cross_file_flow",
  "other",
];

/**
 * Deficiency in Ariadne's **introspection / classifier DSL** that blocks the
 * investigator from expressing a precise classifier. Drafts a backlog sub-task
 * under the single static parent (`INTROSPECTION_GAP_PARENT_TASK_ID`).
 */
export interface IntrospectionGap {
  /** Kebab-case identifiers of the signals the classifier would need. */
  signals_needed: string[];
  title: string;
  description: string;
}

/**
 * Deficiency in Ariadne's **resolver** that is the real root cause of the
 * false-positive group. Drafts a top-level backlog task, or attaches to an
 * existing one when `existing_task_id` is set.
 *
 * Required on every response that proposes a working classifier (`predicate`
 * or `builtin`): the classifier is a workaround; the bug is the real fix.
 */
export interface AriadneBug {
  root_cause_category: AriadneRootCauseCategory;
  title: string;
  description: string;
  /**
   * Set when `mcp__backlog__task_search` already found a task covering this
   * root cause. Finalize attaches to it instead of creating a new one.
   * Format: `TASK-<N>` or `TASK-<N>.<M>...`.
   */
  existing_task_id: string | null;
}

/**
 * Introspection-gap task produced by `apply_proposals` and filed by the main
 * agent under `INTROSPECTION_GAP_PARENT_TASK_ID` in Step 6a. One per
 * investigator response that populated `introspection_gap`.
 */
export interface IntrospectionGapTaskToCreate {
  /** Source group that surfaced this gap. */
  group_id: string;
  title: string;
  description: string;
  signals_needed: string[];
}

/**
 * Ariadne-bug task produced by `apply_proposals` and filed by the main agent
 * as a top-level backlog task in Step 6b. The resolved task id is written
 * back onto `KnownIssue.backlog_task` for the `target_registry_group_id`
 * entry via `link_ariadne_bug_tasks`.
 */
export interface AriadneBugTaskToCreate {
  /** Source group that surfaced this bug. */
  group_id: string;
  /** Target registry entry that carries the linked `backlog_task` once the task lands. */
  target_registry_group_id: string;
  root_cause_category: AriadneRootCauseCategory;
  title: string;
  description: string;
  /** Non-null when the investigator matched an existing backlog task; skip create, attach. */
  existing_task_id: string | null;
}

// ===== Builtin classifier spec =====
//
// Emitted by the investigator when `proposed_classifier.kind === "builtin"`.
// The main agent consumes it in Step 4.5 (via `render_classifier`) to author
// the `.ts` source file at the pre-assigned path. The union is closed — every
// op is enumerated in both the type and the renderer's translation table.

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
  // ===== grep-correlation ops (read ctx.entry.file_path vs hit file, neighbouring lines) =====
  | { op: "grep_hits_all_intra_file"; value: boolean }
  | { op: "grep_hit_neighbourhood_matches"; pattern: string; window: number }
  // ===== definition-site feature ops =====
  | { op: "definition_feature_eq"; name: string; value: boolean }
  | { op: "accessor_kind_eq"; value: "getter" | "setter" | "none" }
  // ===== unindexed-test-dir caller signal =====
  | { op: "has_unindexed_test_caller"; value: boolean }
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
  "grep_hits_all_intra_file",
  "grep_hit_neighbourhood_matches",
  "definition_feature_eq",
  "accessor_kind_eq",
  "has_unindexed_test_caller",
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
  /**
   * Required when `proposed_classifier.kind === "builtin"`; null otherwise.
   * The main agent renders the spec to TypeScript source in Step 4.5.
   */
  classifier_spec: BuiltinClassifierSpec | null;
  /**
   * Set when the investigator's classifier extends an existing registry entry
   * rather than the group being investigated. `group_id` still equals the
   * dispatch group; `retargets_to` names the existing entry to upsert against
   * and drives the authored `.ts` filename. When set, `positive_examples` and
   * `negative_examples` must be empty — their indices would reference the
   * wrong group's entries.
   */
  retargets_to: string | null;
  /**
   * Signal-library / classifier-DSL deficiency. Non-null ↔ `signals_needed`
   * is non-empty. Finalize files this as a sub-task under
   * `INTROSPECTION_GAP_PARENT_TASK_ID`.
   */
  introspection_gap: IntrospectionGap | null;
  /**
   * Resolver-level root cause behind this false-positive group. REQUIRED when
   * `proposed_classifier` is non-null and its `kind` is not `"none"` — the
   * classifier is a workaround; this is the real fix. Finalize files this as a
   * top-level task (or attaches to `existing_task_id`) and writes the resolved
   * id into the registry entry's `backlog_task` field.
   */
  ariadne_bug: AriadneBug | null;
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
  entries_examined_count: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}
