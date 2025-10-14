/**
 * Ariadne Core - Public API
 *
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Main coordinator
export { Project } from './project'

// Core processing functions
export { build_semantic_index } from './index_single_file/semantic_index'
// DEPRECATED: resolve_symbols is no longer used by Project (uses ResolutionRegistry instead)
// Kept for backward compatibility with old tests. Will be removed in future version.
// export { resolve_symbols } from './resolve_references/symbol_resolution'
export { detect_call_graph } from './trace_call_graph/detect_call_graph'

// Project-level registries
export {
  DefinitionRegistry,
  TypeRegistry,
  ScopeRegistry,
  ExportRegistry,
  ImportGraph,
  ResolutionRegistry
} from './project'
