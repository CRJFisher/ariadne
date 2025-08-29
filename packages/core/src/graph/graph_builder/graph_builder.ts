/**
 * Graph Builder - Core orchestration module
 *
 * Coordinates all analysis features to build a unified project graph.
 * This module connects the various analysis capabilities (call graph,
 * scope analysis, type tracking, etc.) into a cohesive system.
 * 
 * Note: This module is a wrapper around the main code_graph.ts module
 * for backwards compatibility and storage integration.
 */

import {
  StorageInterface,
  StoredFile,
  ProjectState,
} from "../../storage/storage_interface";
import {
  CodeGraph,
  generate_code_graph,
  CodeGraphOptions,
} from "../../code_graph";
import { Language } from "@ariadnejs/types";

/**
 * Unified project graph - alias for CodeGraph for backwards compatibility
 */
export type ProjectGraph = CodeGraph;

/**
 * Graph builder configuration - extends CodeGraphOptions with storage
 */
export interface GraphBuilderConfig extends CodeGraphOptions {
  /**
   * Storage instance for persisting results.
   * Optional - if not provided, graph is built but not persisted.
   */
  storage?: StorageInterface;
}

/**
 * Build the complete project graph
 * 
 * This is now a wrapper around generate_code_graph for backwards compatibility
 * and to add storage integration.
 */
export async function build_project_graph(
  config: GraphBuilderConfig
): Promise<ProjectGraph> {
  // Build the graph using the main code_graph module
  const graph = await generate_code_graph({
    root_path: config.root_path,
    include_patterns: config.include_patterns,
    exclude_patterns: config.exclude_patterns,
  });

  // Persist to storage if provided
  if (config.storage) {
    // TODO: Save the graph to storage
    // await config.storage.save_graph(graph);
  }

  return graph;
}

// Re-export main types from code_graph for convenience
export { 
  CodeGraph,
  CodeGraphOptions,
  FunctionNode,
  CallEdge,
  CallGraph,
  FileAnalysis,
  TypeIndex,
  SymbolIndex,
} from "../../code_graph";

// Re-export query functions
export { 
  get_call_graphs,
  type CallGraphInfo,
} from "../../graph_queries";
