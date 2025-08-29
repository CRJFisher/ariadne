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

export {
  get_call_graphs,
  type CallGraphInfo,
} from './graph_queries';

// Call resolution functions (global phase)
export {
  resolve_method_calls,
  resolve_constructor_calls,
  resolve_all_calls,
  type ResolvedMethodCall,
  type ResolvedConstructorCall
} from './call_graph/call_resolution';

// That's it! Everything else is internal implementation details.