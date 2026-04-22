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
  observed_count?: number;
  observed_projects?: string[];
  last_seen_run?: string;
  /** Curator-populated tag indicating the classifier is producing too many outliers. */
  drift_detected?: boolean;
}

// ===== Curator state =====

export interface CurationOutcome {
  qa_groups_checked: number;
  qa_outliers_found: number;
  investigated_groups: number;
  classifiers_proposed: number;
  backlog_tasks_proposed: string[];
  /** Snapshot of wip-status group example counts at curation time, keyed by group_id. */
  wip_group_example_counts: Record<string, number>;
}

export interface CuratedRunEntry {
  run_id: string;
  project: string;
  run_path: string;
  curated_at: string;
  outcome: CurationOutcome;
}

export interface CuratorState {
  curated_runs: CuratedRunEntry[];
}

// ===== Scan =====

export interface ScanOptions {
  project: string | null;
  last: number | null;
  run: string | null;
  reinvestigate: boolean;
}

export interface ScanResultItem {
  run_id: string;
  project: string;
  run_path: string;
  reason: "uncurated" | "reinvestigate";
  wip_groups_with_growth: string[];
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

export type ClassifierAxis = "A" | "B" | "C";

/**
 * Proposal from the investigator. Normalised shapes (mirrors the authoritative
 * `ClassifierSpec` in self-repair-pipeline):
 *   { kind: "none" }
 *   { kind: "builtin";   function_name; min_confidence }
 *   { kind: "predicate"; axis; expression; min_confidence }
 */
export type ClassifierSpecProposal =
  | { kind: "none" }
  | { kind: "builtin"; function_name: string; min_confidence: number }
  | { kind: "predicate"; axis: ClassifierAxis; expression: unknown; min_confidence: number };

export interface BacklogRefProposal {
  title: string;
  description: string;
}

export interface CodeChange {
  path: string;
  /** Full file contents to write verbatim (not a unified-diff). */
  contents: string;
}

export interface InvestigateResponse {
  group_id: string;
  proposed_classifier: ClassifierSpecProposal | null;
  backlog_ref: BacklogRefProposal | null;
  new_signals_needed: string[];
  code_changes: CodeChange[];
  reasoning: string;
}
