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
  update_file_graph,
  analyze_file,
  query_graph
} from './graph_builder';

// Re-export for convenience
export type { StorageInterface } from '../../storage/storage_interface';