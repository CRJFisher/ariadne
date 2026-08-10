/**
 * Types for entry-point detection: what `extract_entry_points` produces and
 * what downstream stages (triage, finalization) consume.
 *
 * The classifier DSL for the known-issues registry lives in `known_issues.ts`.
 * The published triage-results wire contract lives in
 * `@ariadnejs/skill-protocol` (`triage_results.ts`).
 */

import type { ReceiverKind, ResolutionFailure } from "./resolution_failure.js";
import type { FilePath } from "./location.js";

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
   * Read by builtin classifiers as a definition-site feature — distinct from
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
   * method or standalone function.
   * @language javascript,typescript
   */
  definition_is_object_literal_method: boolean;
  /**
   * `"getter"` / `"setter"` when the definition carries the `get` / `set`
   * keyword (class accessor). `null` otherwise.
   * @language javascript,typescript
   */
  accessor_kind: "getter" | "setter" | null;
}

/**
 * Summary diagnosis of where in Ariadne's pipeline the detection of callers
 * failed for a flagged entry point. One of the two deterministic fault signals
 * (the other is `ResolutionFailure`) the fault-area derivation keys on.
 */
export type EntryPointDiagnosis =
  | "no-textual-callers"
  | "callers-not-in-registry"
  | "callers-in-registry-unresolved"
  | "callers-in-registry-wrong-target"
  | "callers-outside-indexed-corpus"
  | "references-without-call-syntax";

export interface EntryPointDiagnostics {
  /**
   * Textual call sites for this function in the indexed corpus, qualified: an
   * occurrence inside a comment or a string never counts, and a line declaring
   * a callable of the same name (a sibling override, an abstract signature,
   * this function's own definition) is that declaration, not a call.
   */
  grep_call_sites: GrepHit[];
  /**
   * Grep hits in files that were discovered but not indexed — held out by a
   * project-config `exclude` or a folder scope, or dropped by an indexing
   * error. Populated by a second grep pass over exactly that residue, qualified
   * by the same rules as `grep_call_sites`, so a caller Ariadne never looked at
   * is distinguishable from one it looked at and missed.
   */
  grep_call_sites_outside_index: GrepHit[];
  /**
   * Non-call references to this callable in the indexed corpus: a getter read,
   * a bare-name callback registration, a dict or list registration value.
   *
   * A caller that carries no call-paren syntax is invisible to both grep
   * channels by construction, so without this channel such a member reports
   * `no-textual-callers` — indistinguishable from a genuine entry point.
   */
  reference_sites: ReferenceSiteDiagnostic[];
  /** CallReferences in the call graph where name matches this entry point */
  ariadne_call_refs: CallRefDiagnostic[];
  /** Summary diagnosis of where in Ariadne's pipeline the detection failed */
  diagnosis: EntryPointDiagnosis;
  /**
   * True when at least one indexed `grep_call_sites` hit has an EMPTY `captures`
   * array — a textual call site the query/extractor produced no `CallReference`
   * for. Distinguishes a genuine extraction gap (capture never fired →
   * deterministic `syntactic_extraction`) from a ref-produced-but-lost case
   * (capture present → needs judgement). Consumed by `derive_fault_area`'s
   * `callers-not-in-registry` fallback; stamped without re-grepping.
   */
  has_uncaptured_indexed_grep_hit: boolean;
}

/**
 * One non-call mention of a callable, taken from the indexer's own reference
 * records rather than from text — structured, language-agnostic, and keyed on
 * the reference's resolved name rather than on a regex match.
 */
export interface ReferenceSiteDiagnostic {
  file_path: FilePath;
  line: number;
  content: string;
  /** The indexer's reference kind, e.g. `property_access`, `variable_reference`. */
  reference_kind: string;
  /** How the name was reached, when the indexer recorded it. */
  access_type: string | null;
  /** The receiver's syntactic form, when the reference had one. */
  receiver_kind: string | null;
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
 * text so builtin classifiers can consume them uniformly.
 *
 * Registry entries today consume only `is_super_call` and `is_dynamic_dispatch`;
 * the remaining flags are populated best-effort so new builtin classifiers
 * reading them do not require an extract-layer change.
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
  /** `call_site_syntax.index_key_is_literal === false` (e.g. `this._hooks[name].call()`) */
  is_dynamic_dispatch: boolean;
}

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
