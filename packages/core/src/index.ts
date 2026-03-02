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
  ResolutionRegistry,
} from "./project";

// Profiling
export { profiler } from "./profiling";

// Test file detection
export { is_test_file } from "./project/detect_test_file";

// Project loading
export { load_project } from "./project/load_project";
export type { LoadProjectOptions } from "./project/load_project";

// File discovery
export {
  SUPPORTED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_GLOBS,
  is_supported_file,
  parse_gitignore,
  should_ignore_path,
  find_source_files,
} from "./project/file_loading";
