/**
 * Types for entry-point detection: what `extract_entry_points` produces,
 * what downstream stages (triage, finalization) consume, and the shape of
 * the known-entrypoints (dead-code whitelist) registry.
 *
 * The classifier DSL for the known-issues registry lives in `known_issues_types.ts`.
 */

import type { ReceiverKind, ResolutionFailure } from "@ariadnejs/types";

// ===== Analysis Input =====

export interface FunctionEntry {
  name: string;
  file_path: string;
  start_line: number;
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
  /**
   * Tree-sitter capture names that fired at this (file, line) during resolution.
   * Empty array when no `CallReference` was produced at the line — that fact is
   * what `missing_capture_at_grep_hit` classifier entries key off.
   */
  captures: string[];
}

/**
 * Syntactic flags derived from a `CallReference` and its source line.
 *
 * Derived (not persisted upstream): core does not emit a `SyntacticFeatures`
 * record on `CallReference`. `find_matching_call_refs` computes these at
 * extraction time by combining `CallReference` fields with the source line
 * text so the auto-classifier predicate evaluator can consume them uniformly.
 *
 * Registry entries today consume only `is_super_call` and `is_dynamic_dispatch`;
 * the remaining flags are populated best-effort so new registry entries adding
 * them do not require an extract-layer change.
 */
export interface SyntacticFeatures {
  /** `call_type === "constructor"` */
  is_new_expression: boolean;
  /** Source line starts the receiver with `super.` */
  is_super_call: boolean;
  /** Source line uses `?.` to invoke the method */
  is_optional_chain: boolean;
  /** Source line prefixes the call with `await ` */
  is_awaited: boolean;
  /** `is_callback_invocation === true` (synthetic edge from forEach-style dispatch) */
  is_callback_arg: boolean;
  /** Not surfaced by core — always false. */
  is_inside_try: boolean;
  /** `call_site_syntax.index_key_is_literal === false` (e.g. `this._hooks[name].call()`) */
  is_dynamic_dispatch: boolean;
}

/** Stable list of `SyntacticFeatures` keys — drives registry validation. */
export const SYNTACTIC_FEATURE_NAMES = [
  "is_new_expression",
  "is_super_call",
  "is_optional_chain",
  "is_awaited",
  "is_callback_arg",
  "is_inside_try",
  "is_dynamic_dispatch",
] as const;

export type SyntacticFeatureName = typeof SYNTACTIC_FEATURE_NAMES[number];

export interface CallRefDiagnostic {
  caller_function: string;
  caller_file: string;
  call_line: number;
  call_type: "function" | "method" | "constructor";
  resolution_count: number;
  resolved_to: string[];
  /** `"none"` when `call_type !== "method"` (core leaves `call_site_syntax` absent). */
  receiver_kind: ReceiverKind | "none";
  /** `null` on resolved calls (core leaves `resolution_failure` absent when `resolutions.length > 0`). */
  resolution_failure: ResolutionFailure | null;
  syntactic_features: SyntacticFeatures;
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

