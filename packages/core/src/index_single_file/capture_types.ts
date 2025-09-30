/**
 * Backward compatibility re-exports
 * @deprecated Import from parse_and_query_code/capture_types instead
 */

export {
  SemanticCategory,
  SemanticEntity,
  type CaptureMapping,
  type LanguageCaptureConfig,
} from "./parse_and_query_code/capture_types";

// NormalizedCapture was removed in Epic 11 refactoring
// Legacy tests that use it need to be migrated to the builder pattern