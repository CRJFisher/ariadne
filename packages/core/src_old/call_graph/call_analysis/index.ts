/**
 * Public API for call analysis modules
 * 
 * This module exports the main functions and types needed by consumers
 * of the call analysis functionality.
 */

// Main analysis functions
export {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  compute_class_enclosing_range,
  resolve_method_call_pure,
  resolve_call_return_type
} from './core';

// Type exports
export type {
  CallAnalysisConfig,
  CallAnalysisResult,
  FileCache,
  FunctionCall
} from './types';

// Re-export from types package for convenience
export type { TypeDiscovery } from '@ariadnejs/types';

export type {
  MethodResolutionResult
} from './reference_resolution';