/**
 * Ariadne Core - Public API
 *
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Main coordinator
export { Project } from "./project";

// Core processing functions
export { build_index_single_file } from "./index_single_file/index_single_file";
export { trace_call_graph } from "./trace_call_graph/trace_call_graph";

// Project-level registries
export {
  DefinitionRegistry,
  TypeRegistry,
  ScopeRegistry,
  ExportRegistry,
  ImportGraph,
  ResolutionRegistry
} from "./project";

// Profiling
export { profiler } from "./profiling";
