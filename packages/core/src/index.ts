/**
 * Ariadne Core - Public API
 * 
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Main API functions
export {
  generate_code_graph,
  type CodeGraph,
  type CodeGraphOptions,
} from './code_graph';

// TODO: graph_queries module is missing
// export {
//   get_call_graphs,
//   type CallGraphInfo,
// } from './graph_queries';

// Call resolution functions (global phase)
export {
  resolve_method_calls,
  resolve_constructor_calls,
  resolve_all_calls,
  type ResolvedMethodCall,
  type ResolvedConstructorCall
} from './call_graph/call_resolution';

// Symbol construction utilities
export {
  construct_symbol,
  parse_symbol,
  construct_function_symbol,
  construct_method_symbol,
  construct_class_symbol,
  SPECIAL_SYMBOLS,
  type SymbolComponents,
  type ParsedSymbol
} from './utils';

// Project management
export {
  ProjectManager,
  create_project_context,
  type ProjectManagerContext,
  type ProjectConfig,
  type ProjectStats,
  type FileChangeEvent,
  type FileChangeType
} from './project/project_manager';

// Import resolution utilities
export {
  normalize_module_path
} from './import_export/import_resolution';

// Re-export common types from @ariadnejs/types for convenience
export type {
  CallGraph,
  FunctionNode as CallGraphNode,
  CallEdge as CallGraphEdge
} from '@ariadnejs/types';

// Import for Project alias
import { ProjectManager } from './project/project_manager';

// Alias for backward compatibility  
export const Project = ProjectManager;

// That's it! Everything else is internal implementation details.