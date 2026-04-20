/**
 * Shared type definitions for top-level nodes analysis
 */

// ===== Analysis Input =====

export interface FunctionEntry {
  name: string;
  file_path: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  kind: "function" | "method" | "constructor";
  signature?: string;
  tree_size: number;
}

// ===== Enriched Entry Point (with CallableNode metadata + diagnostics) =====

export interface EnrichedFunctionEntry extends FunctionEntry {
  // Metadata from CallableNode.definition
  is_exported: boolean;
  access_modifier?: "public" | "private" | "protected";

  // Pre-gathered diagnostics
  diagnostics: EntryPointDiagnostics;
}

export interface EntryPointDiagnostics {
  /** Textual grep results for calls to this function across source files */
  grep_call_sites: GrepHit[];
  /** CallReferences in the call graph where name matches this entry point */
  ariadne_call_refs: CallRefDiagnostic[];
  /** Summary diagnosis of where in Ariadne's pipeline the detection failed */
  diagnosis:
    | "no-textual-callers"
    | "callers-not-in-registry"
    | "callers-in-registry-unresolved"
    | "callers-in-registry-wrong-target";
}

export interface GrepHit {
  file_path: string;
  line: number;
  content: string;
}

export interface CallRefDiagnostic {
  caller_function: string;
  caller_file: string;
  call_line: number;
  call_type: "function" | "method" | "constructor";
  resolution_count: number;
  resolved_to: string[];
}

export interface AnalysisResult {
  project_name: string;
  project_path: string;
  entry_points: EnrichedFunctionEntry[];
  [key: string]: unknown;
}

// ===== Known Entrypoints Registry =====

export interface KnownEntrypoint {
  name: string;
  /** Relative path from project root. Omit for pattern-based matching (frameworks). */
  file_path?: string;
  /** Optional kind filter for pattern-based matching. */
  kind?: "function" | "method" | "constructor";
  /** Informational only, not used for matching. */
  start_line?: number;
}

export interface KnownEntrypointSource {
  source: string;       // "project", "react", "django", etc.
  description: string;
  entrypoints: KnownEntrypoint[];
}

// ===== Phase 2 Outputs (Grouped by Root Cause) =====

/**
 * A single false positive entry point detection
 */
export interface FalsePositiveEntry {
  name: string;
  file_path: string;
  start_line: number;
  signature?: string;
}

/**
 * A group of false positive detections sharing the same root cause.
 * Multiple entry points can be grouped together when they share
 * the same root cause and fix strategy.
 */
export interface FalsePositiveGroup {
  group_id: string;              // kebab-case short identifier (e.g., "builder-method-chain")
  root_cause: string;            // Full description of the root cause
  reasoning: string;             // Explanation of why this causes false positives
  existing_task_fixes: string[]; // Related backlog tasks
  entries: FalsePositiveEntry[];
}

/**
 * The full triage results file structure
 */
export interface FalsePositiveTriageResults {
  groups: Record<string, FalsePositiveGroup>;  // Keyed by group_id for easy lookup
  last_updated: string;
}

// ===== Known-Issues Registry (classifier catalog) =====
//
// Canonical catalog of Ariadne's known failure modes. Stored on disk as
// `.claude/skills/self-repair-pipeline/known_issues/registry.json`. Consumed
// by the `auto_classify` pipeline stage and by the triage-curator skill.
//
// Orthogonal to the dead-code whitelist read by the Stop hook — that lives
// at `~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json` and is
// a separate, human-maintained list of legitimate entry points.

export type KnownIssueStatus = "permanent" | "wip" | "fixed";

export type KnownIssueLanguage = "typescript" | "javascript" | "python" | "rust";

export interface KnownIssueExample {
  file: string;
  line: number;
  snippet: string;
}

export interface KnownIssue {
  /** Canonical identifier, kebab-case. */
  group_id: string;
  title: string;
  description: string;
  status: KnownIssueStatus;
  languages: KnownIssueLanguage[];
  /** Links this issue → work prioritization. Absent when no backlog task exists. */
  backlog_task?: string;
  examples: KnownIssueExample[];
  classifier: ClassifierSpec;
  // Curator-populated fields — never edited by hand, never used for matching.
  observed_count?: number;
  observed_projects?: string[];
  last_seen_run?: string;
}

export type ClassifierAxis = "A" | "B" | "C";

export type ClassifierSpec =
  | { kind: "none" }
  | { kind: "builtin"; function_name: string; min_confidence: number }
  | { kind: "predicate"; axis: ClassifierAxis; expression: PredicateExpr; min_confidence: number };

/**
 * Structured, serialisable predicate DSL over an entry + diagnostics. No eval.
 *
 * Exactly 12 operators: 3 combinators + 9 leaves. Schema validation rejects
 * any `op` value not listed here.
 */
export type PredicateExpr =
  // Combinators
  | { op: "all"; of: PredicateExpr[] }
  | { op: "any"; of: PredicateExpr[] }
  | { op: "not"; of: PredicateExpr }
  // Leaves
  | { op: "diagnosis_eq"; value: string }
  | { op: "language_eq"; value: string }
  | { op: "decorator_matches"; pattern: string }
  | { op: "has_capture_at_grep_hit"; capture_name: string }
  | { op: "missing_capture_at_grep_hit"; capture_name: string }
  | { op: "grep_line_regex"; pattern: string }
  | { op: "resolution_failure_reason_eq"; value: string }
  | { op: "receiver_kind_eq"; value: string }
  | { op: "syntactic_feature_eq"; name: string; value: boolean };

/** The exhaustive set of recognised predicate operators. Used by schema validation. */
export const PREDICATE_OPERATORS = [
  "all",
  "any",
  "not",
  "diagnosis_eq",
  "language_eq",
  "decorator_matches",
  "has_capture_at_grep_hit",
  "missing_capture_at_grep_hit",
  "grep_line_regex",
  "resolution_failure_reason_eq",
  "receiver_kind_eq",
  "syntactic_feature_eq",
] as const;

export type PredicateOperator = typeof PREDICATE_OPERATORS[number];

/** The full registry file on disk is a JSON array of `KnownIssue`. */
export type KnownIssuesRegistry = KnownIssue[];

