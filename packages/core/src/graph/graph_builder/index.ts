/**
 * Graph Builder Feature - Public API
 *
 * Dispatcher/marshaler for graph building operations.
 * Coordinates analysis across all language-specific implementations.
 */

export {
  // Core types
  GraphNode,
  GraphEdge,
  ProjectGraph,
  FileAnalysisResult,
  GraphBuilderConfig,

  // Main functions
  build_project_graph,
  query_graph,
} from "./graph_builder";

export {
  // File scanning utilities
  scan_files,
  read_file,
  detect_language,
} from "./file_scanner";
