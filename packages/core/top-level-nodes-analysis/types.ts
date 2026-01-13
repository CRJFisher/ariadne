/**
 * Shared type definitions for top-level nodes analysis
 */

// ===== Ground Truth =====

export interface APIMethod {
  name: string;
  file_path: string;
  start_line: number;
  end_line?: number;
  signature: string;
  kind: string;
  is_public: boolean;
  description: string;
}

// ===== Analysis Input =====

export interface FunctionEntry {
  name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  kind: string;
  signature?: string;
  tree_size: number;
}

export interface AnalysisResult {
  entry_points: FunctionEntry[];
  [key: string]: unknown;
}

// ===== Phase 1 Outputs =====

export interface APICorrectlyDetected {
  name: string;
  file_path: string;
  line: number;
  signature: string;
  detected_at_line: number;
  reasoning: string;
}

export interface APIMissingFromDetection {
  name: string;
  file_path: string;
  line: number;
  signature: string;
  triage_analysis: {
    why_missed: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  };
}

export interface APIInternalsExposed {
  name: string;
  file_path: string;
  detected_at_line: number;
  signature?: string;
  reasoning: string;
  triage_analysis: {
    why_exposed: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  };
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

// ===== Legacy Phase 2 Output (deprecated) =====

export interface InternalMisidentified {
  name: string;
  file_path: string;
  start_line: number;
  signature?: string;
  root_cause: string;
  reasoning: string;
  triage_analysis: {
    detection_gap: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  };
}
