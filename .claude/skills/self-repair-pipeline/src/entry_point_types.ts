/**
 * Temporary re-export shim. The canonical types live in `@ariadnejs/types`'s
 * `entry_point` and `false_positive_results` modules; this file is dropped
 * once skill consumers move to the package import directly (see TASK-190.17.13).
 */

export type {
  EnrichedEntryPoint,
  DefinitionFeatures,
  DefinitionFeatureName,
  EntryPointDiagnostics,
  GrepHit,
  SyntacticFeatures,
  SyntacticFeatureName,
  CallRefDiagnostic,
  AnalysisSourceInfo,
  AnalysisResult,
  FalsePositiveEntry,
  FalsePositiveGroup,
  FalsePositiveTriageResults,
} from "@ariadnejs/types";
export {
  DEFINITION_FEATURE_NAMES,
  SYNTACTIC_FEATURE_NAMES,
} from "@ariadnejs/types";
