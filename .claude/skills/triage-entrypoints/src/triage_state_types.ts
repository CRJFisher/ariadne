/**
 * State types for the self-repair triage pipeline.
 *
 * The triage state file tracks entry point candidates through two phases:
 * - "triage": investigators running as a continuous worker pool
 * - "complete": all entries processed, ready to finalize
 */

import type { EntryPointDiagnostics, ClassifierHint } from "@ariadnejs/types";

export type { ClassifierHint };

// ===== Top-Level State =====

export interface TriageState {
  project_name: string;
  project_path: string;
  phase: "triage" | "complete";
  entries: TriageEntry[];
  created_at: string;
  updated_at: string;
}

// ===== Per-Entry State =====

export type TriageRoute = "known-unreachable" | "llm-triage";

export interface TriageEntry {
  entry_index: number;
  name: string;
  file_path: string;
  start_line: number;
  kind: string;
  signature: string | null;
  route: TriageRoute;
  diagnosis: string;
  /**
   * Provenance tag for entries placed on `route="known-unreachable"`. Examples:
   * `"registry:<group_id>"` for predicate/builtin classifier hits, or
   * `"previously-confirmed-tp"` for entries reused from a prior run's TP cache.
   * `null` for `route="llm-triage"` entries.
   */
  known_source: string | null;
  status: "pending" | "completed" | "failed";
  result: TriageEntryResult | null;
  error: string | null;
  /** Enriched metadata for template substitution (stripped on finalize) */
  is_exported: boolean;
  access_modifier: string | null;
  /** Pre-gathered diagnostics for self-service context */
  diagnostics: EntryPointDiagnostics;
  /**
   * True when a predicate classifier from the known-issues registry matched this
   * entry at or above its `min_confidence` threshold. Orthogonal to `route`:
   * these entries carry `route === "known-unreachable"` and `status === "completed"`,
   * and are skipped by `get_next_triage_entry`.
   */
  auto_classified: boolean;
  /**
   * Sub-threshold classifier matches that did not reach `min_confidence`.
   * Attached to entries routed to `llm-triage` so the prompt can surface the
   * signal; always `[]` for entries already completed by the classifier.
   */
  classifier_hints: ClassifierHint[];
  /**
   * Run-id of the prior finalized run that supplied this entry's verdict via
   * the TP cache. Set only when `known_source === "previously-confirmed-tp"`;
   * otherwise `null`. Used by diff/audit tooling to distinguish reused
   * verdicts from re-investigated ones.
   */
  tp_source_run_id: string | null;
}

export interface TriageEntryResult {
  /** true = no real callers found; Ariadne is correct. false = Ariadne missed callers → false positive. */
  ariadne_correct: boolean;
  /** "confirmed-unreachable" when ariadne_correct=true; kebab-case detection gap id otherwise */
  group_id: string;
  root_cause: string;
  reasoning: string;
}

// ===== Run Manifest (per-run metadata) =====

export const RUN_MANIFEST_SCHEMA_VERSION = 1;

export type RunStatus = "active" | "finalized" | "abandoned";

export interface TpCacheRecord {
  enabled: boolean;
  /** Source run-id that supplied the cached TPs. `null` when no source was found / cache disabled. */
  source_run_id: string | null;
  skipped_count: number;
  skipped_entry_keys: TpCacheEntryKey[];
}

export interface TpCacheEntryKey {
  name: string;
  file_path: string;
  kind: string;
  start_line: number;
}

export interface RunManifest {
  schema_version: number;
  run_id: string;
  project_name: string;
  project_path: string;
  created_at: string;
  finalized_at: string | null;
  status: RunStatus;
  source_analysis_path: string;
  source_analysis_run_id: string;
  max_count: number;
  /** Full HEAD commit hash for the target repo, or `null` for non-git projects. */
  commit_hash: string | null;
  tp_cache: TpCacheRecord;
}
