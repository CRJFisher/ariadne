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
  update_graph_for_file as update_file_graph,
  analyze_file,
  query_graph,
} from "./graph_builder";
