/**
 * State types for the self-repair triage pipeline.
 *
 * The triage state file tracks entry point candidates through two phases:
 * - "triage": investigators running as a continuous worker pool
 * - "complete": all entries processed, ready to finalize
 */

import type { EntryPointDiagnostics } from "./types.js";

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
  known_source: string | null;
  status: "pending" | "completed" | "failed";
  result: TriageEntryResult | null;
  error: string | null;
  /** Enriched metadata for template substitution (stripped on finalize) */
  is_exported: boolean;
  access_modifier: string | null;
  /** Pre-gathered diagnostics for self-service context */
  diagnostics: EntryPointDiagnostics;
}

export interface TriageEntryResult {
  /** true = no real callers found; Ariadne is correct. false = Ariadne missed callers → false positive. */
  ariadne_correct: boolean;
  /** "confirmed-unreachable" when ariadne_correct=true; kebab-case detection gap id otherwise */
  group_id: string;
  root_cause: string;
  reasoning: string;
}
