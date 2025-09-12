/**
 * Parameter type inference module exports
 * 
 * Only exports what is actually used by external modules (file_analyzer.ts)
 */

// Export only the types and functions that are actually used externally
export {
  // Types needed by file_analyzer.ts
  ParameterAnalysis,
  ParameterInferenceContext,
  // Main API function that should be used by file_analyzer.ts
  infer_parameter_types,
  infer_all_parameter_types,
  // Also keep extract_parameters for backward compatibility
  extract_parameters,
} from './parameter_type_inference';

// Internal exports for testing only - should not be used by external modules
// Test files can import these directly from their respective source files if needed