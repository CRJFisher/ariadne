/**
 * Canonical catalog of Ariadne's known failure modes. Stored on disk as
 * `.claude/skills/self-repair-pipeline/known_issues/registry.json` and consumed
 * by the `auto_classify` pipeline stage and by the triage-curator skill.
 *
 * Orthogonal to the dead-code whitelist read by the Stop hook — that lives
 * at `~/.ariadne/self-repair-pipeline/known_entrypoints/<pkg>.json` and is
 * a separate, human-maintained list of legitimate entry points.
 */

import type { SyntacticFeatureName } from "./entry_point_types.js";

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
  | { op: "decorator_matches"; pattern: string; compiled_pattern?: RegExp }
  | { op: "has_capture_at_grep_hit"; capture_name: string }
  | { op: "missing_capture_at_grep_hit"; capture_name: string }
  | { op: "grep_line_regex"; pattern: string; compiled_pattern?: RegExp }
  | { op: "resolution_failure_reason_eq"; value: string }
  | { op: "receiver_kind_eq"; value: string }
  | { op: "syntactic_feature_eq"; name: SyntacticFeatureName; value: boolean };

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
