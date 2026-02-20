/**
 * State types for the self-repair triage pipeline.
 *
 * The triage state file tracks entry point candidates through phases:
 * triage → aggregation → meta-review → fix-planning → complete.
 */

// ===== Top-Level State =====

export interface TriageState {
  project_name: string;
  project_path: string;
  analysis_file: string;
  phase: "triage" | "aggregation" | "meta-review" | "fix-planning" | "complete";
  batch_size: number;
  entries: TriageEntry[];
  aggregation: AggregationResult | null;
  meta_review: MetaReviewResult | null;
  fix_planning: FixPlanningState | null;
  created_at: string;
  updated_at: string;
}

// ===== Per-Entry State =====

export type TriageRoute = "known-tp" | "deterministic-fp" | "llm-triage";

export interface TriageEntry {
  entry_index: number;
  name: string;
  file_path: string;
  start_line: number;
  kind: string;
  signature: string | null;
  route: TriageRoute;
  diagnosis: string;
  deterministic_group_id: string | null;
  known_source: string | null;
  status: "pending" | "completed" | "failed";
  result: TriageEntryResult | null;
  error: string | null;
  attempt_count: number;
}

export interface TriageEntryResult {
  is_true_positive: boolean;
  is_likely_dead_code: boolean;
  group_id: string;
  root_cause: string;
  reasoning: string;
}

// ===== Fix Planning State =====

export interface FixPlanningState {
  fix_plans_dir: string;
  groups: Record<string, FixPlanGroupState>;
}

export interface FixPlanGroupState {
  group_id: string;
  root_cause: string;
  entry_count: number;
  sub_phase: "planning" | "synthesis" | "review" | "task-writing" | "complete";
  plans_written: number;
  synthesis_written: boolean;
  reviews_written: number;
  task_file: string | null;
}

// ===== Placeholder types (populated by later pipeline phases) =====

export interface AggregationResult {
  status: "pending" | "completed" | "failed";
  completed_at: string | null;
}

// ===== Meta-Review Types =====

export interface ProposedRule {
  rule_id: string;
  description: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  classification: "true-positive" | "dead-code" | "false-positive";
  group_id: string;
  predicate: string;
  matching_entries: number;
  total_with_classification: number;
  accuracy: number;
  evidence: string;
}

export interface RuleReviewOutput {
  proposed_rules: ProposedRule[];
  summary: {
    total_completed_entries: number;
    rules_proposed: number;
    entries_coverable_by_rules: number;
    coverage_percentage: number;
  };
}

export interface MetaReviewResult {
  status: "pending" | "completed" | "failed";
  completed_at: string | null;
  patterns: RuleReviewOutput | null;
}
