import type {
  AriadneFaultArea,
  KnownIssueLanguage,
} from "@ariadnejs/types";

// ===== Triage results shape (read-only) =====
//
// The published `triage_results/<run-id>.json` wire contract is owned by
// `@ariadnejs/skill-protocol` — the single source of truth shared with the
// producing triage skill. Re-exported here so plan's domain-vocabulary
// imports stay grouped (matching the `@ariadnejs/types` re-export below).
// Plan's `novel:` path reads `novel_issues` and `classifier_regressions`;
// downstream consumers read `confirmed_unreachable[]` with its `source`
// discriminator.

export {
  TRIAGE_RESULTS_SCHEMA_VERSION,
} from "@ariadnejs/skill-protocol";

export type {
  ConfirmedUnreachableSource,
  MemberEvidence,
  NovelIssue,
  PublishedConfirmedUnreachable,
  PublishedEntryRef,
  PublishedUncertain,
  TriageResultsFile,
} from "@ariadnejs/skill-protocol";

// ===== Known-issues registry shape (read/write) =====
//
// Canonical types live in `@ariadnejs/types`. Re-exported here so plan's
// domain-vocabulary imports stay grouped and a downstream rename only touches
// one file.

export type {
  KnownIssue,
  KnownIssueExample,
  KnownIssueLanguage,
  KnownIssueStatus,
} from "@ariadnejs/types";

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

/**
 * Classifier shape plan emits per investigated group. `kind: "none"`
 * retires a classifier; `kind: "builtin"` authors a check function. Predicate
 * classifiers are hand-authored directly in the registry.
 */
export type ClassifierSpecProposal =
  | { kind: "none" }
  | { kind: "builtin"; function_name: string; min_confidence: number };

/**
 * Deficiency in Ariadne's **introspection / classifier DSL** that blocks the
 * investigator from expressing a precise classifier. Grounds a signal-library
 * gap task in the plan engine's task-DB.
 */
export interface SignalLibraryGap {
  /** Kebab-case identifiers of the signals the classifier would need. */
  signals_needed: string[];
  title: string;
  description: string;
}

/**
 * Deficiency in Ariadne's **resolver** that is the real root cause of the
 * dispatched `novel_issue`. Grounds a top-level task in the plan engine's
 * task-DB, or attaches to an existing one when `existing_task_id` is set.
 *
 * Required on every response that proposes a working classifier (`predicate`
 * or `builtin`): the classifier is a workaround; the bug is the real fix.
 */
export interface AriadneBug {
  root_cause_category: AriadneFaultArea;
  title: string;
  description: string;
  /**
   * Set when `mcp__backlog__task_search` already found a task covering this
   * root cause. The deferred actuator attaches to it instead of creating a new
   * one. Format: `TASK-<N>` or `TASK-<N>.<M>...`.
   */
  existing_task_id: string | null;
}

// ===== Builtin classifier spec =====
//
// Emitted by the investigator when `proposed_classifier.kind === "builtin"`.
// The deferred actuator consumes it to author the `.ts` source file at the
// pre-assigned path. The union is closed — every op is enumerated in both the
// type and the actuator's translation table.

export type SignalCheck =
  // ===== predicate-DSL-expressible ops (reusable in builtin context) =====
  | { op: "diagnosis_eq"; value: string }
  | { op: "language_eq"; value: KnownIssueLanguage }
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

/**
 * Exhaustive lookup over the `SignalCheck` op union. Adding a new variant to
 * `SignalCheck` fails this `satisfies` check, not runtime. The lookup is the
 * single source of truth — `SIGNAL_CHECK_OPS` (array form) and
 * `is_signal_check_op` (predicate) both derive from it.
 */
export const SIGNAL_CHECK_OP_LOOKUP = {
  diagnosis_eq: true,
  language_eq: true,
  syntactic_feature_eq: true,
  grep_line_regex: true,
  decorator_matches: true,
  has_capture_at_grep_hit: true,
  missing_capture_at_grep_hit: true,
  receiver_kind_eq: true,
  resolution_failure_reason_eq: true,
  grep_hits_all_intra_file: true,
  grep_hit_neighbourhood_matches: true,
  definition_feature_eq: true,
  accessor_kind_eq: true,
  has_unindexed_test_caller: true,
  callers_count_at_least: true,
  callers_count_at_most: true,
  file_path_matches: true,
  name_matches: true,
} as const satisfies Record<SignalCheck["op"], true>;

/** String-form enumeration of `SignalCheck.op` values, derived from the lookup. */
export const SIGNAL_CHECK_OPS: readonly SignalCheck["op"][] =
  Object.keys(SIGNAL_CHECK_OP_LOOKUP) as SignalCheck["op"][];

export function is_signal_check_op(s: string): s is SignalCheck["op"] {
  return Object.hasOwn(SIGNAL_CHECK_OP_LOOKUP, s);
}

/**
 * Exhaustive lookup over `KnownIssueLanguage`. `is_known_issue_language` is
 * the typed predicate used at LLM-boundary parsers; adding a language to the
 * union fails the `satisfies` check here.
 */
export const KNOWN_ISSUE_LANGUAGE_LOOKUP = {
  typescript: true,
  javascript: true,
  python: true,
  rust: true,
} as const satisfies Record<KnownIssueLanguage, true>;

export function is_known_issue_language(s: string): s is KnownIssueLanguage {
  return Object.hasOwn(KNOWN_ISSUE_LANGUAGE_LOOKUP, s);
}

export interface BuiltinClassifierSpec {
  function_name: string;
  min_confidence: number;
  combinator: "all" | "any";
  checks: SignalCheck[];
  /**
   * Positional indexes into the dispatched novel issue's source entries that
   * the classifier is designed to match. The canonical novel issue is a single
   * false-positive entry, so the only valid index is 0.
   */
  positive_examples: number[];
  /**
   * Positional indexes the classifier must NOT match. Typically empty — with a
   * single-entry novel issue there is no outlier to carve.
   */
  negative_examples: number[];
  /** Copied into the generated file header and the commit-message body. */
  description: string;
}

/**
 * A source entry the investigator chose NOT to cover with the proposed
 * classifier. Names the entry by its positional index into the dispatched
 * novel issue's source entries and carries the investigator's reason.
 */
export interface RejectedMember {
  /** Positional index into the source novel issue's entries. */
  entry_index: number;
  /** Why the entry does not fit the proposed classifier. */
  reason: string;
}

export interface InvestigateResponse {
  group_id: string;
  proposed_classifier: ClassifierSpecProposal | null;
  /**
   * Required when `proposed_classifier.kind === "builtin"`; null otherwise.
   * The deferred actuator renders the spec to TypeScript source.
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
   * is non-empty. Grounds a signal-library gap task in the plan engine's
   * task-DB.
   */
  signal_library_gap: SignalLibraryGap | null;
  /**
   * Resolver-level root cause behind this `novel_issue`. REQUIRED when
   * `proposed_classifier` is non-null and its `kind` is not `"none"` — the
   * classifier is a workaround; this is the real fix. Proposed as a top-level
   * task (or attaches to `existing_task_id`); the deferred actuator writes the
   * resolved id into the registry entry's `backlog_task` field.
   */
  ariadne_bug: AriadneBug | null;
  /**
   * Source entries the investigator could not fit under the proposed
   * classifier. Each `entry_index` must be in range for the dispatched novel
   * issue's source entries, must not appear in
   * `classifier_spec.positive_examples`, and must be unique. Absent or empty
   * array means the investigator vouches that the source entry is covered.
   */
  rejected_members: RejectedMember[];
  reasoning: string;
}

// ===== Investigator session log =====

export type InvestigatorSessionStatus = "success" | "failure" | "blocked_missing_signal";

/**
 * Why the investigator could not produce a working classifier. Only populated when
 * status is "failure".
 *
 * - `group_incoherent`      citations on the novel issue mix unrelated root causes
 * - `pattern_unclear`       single pattern, but discriminating signals unclear
 * - `classifier_infeasible` pattern understood, no DSL/builtin can express it
 * - `registry_conflict`     another registry entry already claims these members
 * - `other`                 anything else; details field must explain
 */
export type InvestigatorFailureCategory =
  | "group_incoherent"
  | "pattern_unclear"
  | "classifier_infeasible"
  | "registry_conflict"
  | "other";

/**
 * Exhaustive lookup over `InvestigatorSessionStatus`. Adding a status to the
 * union fails the `satisfies` check here.
 */
export const INVESTIGATOR_SESSION_STATUS_LOOKUP = {
  success: true,
  failure: true,
  blocked_missing_signal: true,
} as const satisfies Record<InvestigatorSessionStatus, true>;

export function is_investigator_session_status(
  s: string,
): s is InvestigatorSessionStatus {
  return Object.hasOwn(INVESTIGATOR_SESSION_STATUS_LOOKUP, s);
}

/**
 * Exhaustive lookup over `InvestigatorFailureCategory`. Adding a category to
 * the union fails the `satisfies` check here.
 */
export const INVESTIGATOR_FAILURE_CATEGORY_LOOKUP = {
  group_incoherent: true,
  pattern_unclear: true,
  classifier_infeasible: true,
  registry_conflict: true,
  other: true,
} as const satisfies Record<InvestigatorFailureCategory, true>;

export function is_investigator_failure_category(
  s: string,
): s is InvestigatorFailureCategory {
  return Object.hasOwn(INVESTIGATOR_FAILURE_CATEGORY_LOOKUP, s);
}

export interface InvestigatorSessionLog {
  group_id: string;
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
