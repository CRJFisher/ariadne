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
   * `"registry:<group_id>"` for builtin classifier hits, or
   * `"previously-confirmed-tp"` for entries reused from a prior run's TP cache.
   * `null` for `route="llm-triage"` entries.
   */
  known_source: string | null;
  status: "pending" | "completed" | "failed";
  result: TriageEntryResult | null;
  error: string | null;
  /**
   * Count of retry dispatches already consumed for this entry. Starts at 0.
   * An entry becomes `failed` only when its result file is malformed
   * (`merge_results`), so a `failed` entry is retryable: the picker re-dispatches
   * it while `retry_count < MAX_TRIAGE_RETRIES`, incrementing this and clearing
   * the stale result file each time. Once the budget is exhausted the entry
   * terminalizes as `failed`, and its malformed file halts finalize loudly.
   */
  retry_count: number;
  /** Enriched metadata for template substitution (stripped on finalize) */
  is_exported: boolean;
  access_modifier: string | null;
  /** Pre-gathered diagnostics for self-service context */
  diagnostics: EntryPointDiagnostics;
  /**
   * True when a builtin classifier from the known-issues registry matched this
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
  /**
   * True for a would-be TP-cache hit that was deliberately LEFT on the
   * `llm-triage` route (not flipped to `known-unreachable`) so the investigator
   * re-checks a cached verdict that would otherwise be reused unverified. The
   * finalize step compares each sample's fresh verdict against the cached `tp`
   * to compute `manifest.tp_cache.stability`. A sample is an ordinary llm-triage
   * entry to the picker/completion gate — `auto_classified` stays false — so it
   * is investigated and completed normally, never mistaken for an incomplete
   * entry.
   */
  tp_stability_sample: boolean;
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
  /**
   * Agreement rate of the TP-cache stability audit, filled at finalize. `null`
   * until then and whenever no would-be hit was sampled (cache disabled, no
   * source, or zero hits). A low `rate` is the operator's signal that frozen TP
   * verdicts have drifted and the run should be repeated with `--no-reuse-tp`.
   */
  stability: TpStability | null;
}

/**
 * Outcome of the TP-cache stability audit: of the `sampled` would-be cache hits
 * left in the llm-triage pool and re-investigated, `agreed` returned a fresh
 * `tp` verdict matching the cached one. `rate = agreed / sampled`, or `null`
 * when `sampled === 0` (nothing to divide).
 */
export interface TpStability {
  sampled: number;
  agreed: number;
  rate: number | null;
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
