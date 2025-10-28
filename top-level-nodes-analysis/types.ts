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
  [key: string]: any;
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

// ===== Phase 2 Outputs =====

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
