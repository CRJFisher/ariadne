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
