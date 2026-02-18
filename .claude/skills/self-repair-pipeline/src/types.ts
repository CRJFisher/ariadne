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
  start_column: number;
  end_line: number;
  end_column: number;
  kind: "function" | "method" | "constructor";
  signature?: string;
  tree_size: number;
}

// ===== Enriched Entry Point (with CallableNode metadata + diagnostics) =====

export interface EnrichedFunctionEntry extends FunctionEntry {
  // Metadata from CallableNode.definition
  is_exported: boolean;
  access_modifier?: "public" | "private" | "protected";
  is_static?: boolean;
  is_anonymous: boolean;
  callback_context?: {
    is_callback: boolean;
    receiver_is_external: boolean | null;
  };
  call_summary: {
    total_calls: number;
    unresolved_count: number;
    method_calls: number;
    constructor_calls: number;
    callback_invocations: number;
  };

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
}

export interface CallRefDiagnostic {
  caller_function: string;
  caller_file: string;
  call_line: number;
  call_type: "function" | "method" | "constructor";
  resolution_count: number;
  resolved_to: string[];
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

