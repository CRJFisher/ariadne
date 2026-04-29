/**
 * Types for entry-point detection: what `extract_entry_points` produces and
 * what downstream stages (triage, finalization) consume.
 *
 * The classifier DSL for the known-issues registry lives in `known_issues.ts`.
 * Triage-results shapes (false positives, confirmed-unreachable groupings)
 * live in `false_positive_results.ts`.
 */

import type { ReceiverKind, ResolutionFailure } from "./call_chains.js";
import type { FilePath } from "./common.js";

// ===== Enriched Entry Point (with CallableNode metadata + diagnostics) =====

export interface EnrichedEntryPoint {
  name: string;
  file_path: FilePath;
  start_line: number;
  kind: "function" | "method" | "constructor";
  signature?: string;
  tree_size: number;

  // Metadata from CallableNode.definition
  is_exported: boolean;
  access_modifier?: "public" | "private" | "protected";

  /**
   * Features of the definition site itself (not of call references to it).
   * Drives classifier ops like `definition_feature_eq` — distinct from
   * `SyntacticFeatures`, which lives on each `CallRefDiagnostic` and describes
   * the call site.
   */
  definition_features: DefinitionFeatures;

  // Pre-gathered diagnostics
  diagnostics: EntryPointDiagnostics;
}

/**
 * Definition-time flags captured at entry extraction. All fields are populated
 * for JS/TS; for Python/Rust the defaults (`false` / `null`) are used.
 */
export interface DefinitionFeatures {
  /**
   * True when the entry is a method defined as an object-literal
   * property-shorthand (`let o = { name() { ... } }`) rather than a class
   * method or standalone function. JS/TS only.
   */
  definition_is_object_literal_method: boolean;
  /**
   * `"getter"` / `"setter"` when the definition carries the `get` / `set`
   * keyword (JS/TS class accessor). `null` otherwise.
   */
  accessor_kind: "getter" | "setter" | null;
}

/** Stable enum of definition-level feature names. Drives DSL validation. */
export const DEFINITION_FEATURE_NAMES = [
  "definition_is_object_literal_method",
] as const;

export type DefinitionFeatureName = typeof DEFINITION_FEATURE_NAMES[number];

export interface EntryPointDiagnostics {
  /** Textual grep results for calls to this function across source files */
  grep_call_sites: GrepHit[];
  /**
   * Grep hits located in directories excluded from Ariadne's indexing (e.g.
   * `/test/`, `/tests/`, `/__tests__/`, `/spec/`). Populated by a second grep
   * pass run outside the indexed scope so classifiers can distinguish
   * "callers-exist-in-test-dir" from the broader callers-not-in-registry bucket.
   */
  grep_call_sites_unindexed_tests: GrepHit[];
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
  file_path: FilePath;
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
  caller_file: FilePath;
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

/**
 * Provenance for the analysis. Distinguishes locally-checked-out projects
 * from GitHub clones and records the HEAD commit hash so downstream stages
 * can detect when the user re-runs `prepare_triage` against a stale analysis.
 */
export interface AnalysisSourceInfo {
  type: "local" | "github";
  github_url?: string;
  branch?: string;
  /** Full HEAD commit hash at detection time. Absent for non-git projects. */
  commit_hash?: string;
}

export interface AnalysisResult {
  project_name: string;
  project_path: string;
  source?: AnalysisSourceInfo;
  entry_points: EnrichedEntryPoint[];
  [key: string]: unknown;
}
