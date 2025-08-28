/**
 * Graph Builder - Core orchestration module
 *
 * Coordinates all analysis features to build a unified project graph.
 * This module connects the various analysis capabilities (call graph,
 * scope analysis, type tracking, etc.) into a cohesive system.
 */

import {
  StorageInterface,
  StoredFile,
  ProjectState,
} from "../../storage/storage_interface";
import {
  FunctionCallInfo,
  find_function_calls,
  find_function_calls_from_source,
} from "../../call_graph/function_calls";
import {
  MethodCallInfo,
  find_method_calls,
} from "../../call_graph/method_calls";
import {
  ConstructorCallInfo,
  find_constructor_calls,
} from "../../call_graph/constructor_calls";
import { ScopeTree, build_scope_tree } from "../../scope_analysis/scope_tree";
import {
  ImportInfo,
  resolve_imports,
} from "../../import_export/import_resolution";
import {
  ExportInfo,
  detect_exports,
} from "../../import_export/export_detection";
import {
  ModuleGraph,
  build_module_graph,
} from "../../import_export/module_graph";
import {
  TypeInfo,
  track_variable_types,
} from "../../type_analysis/type_tracking";
import {
  ClassHierarchy,
  build_class_hierarchy,
} from "../../inheritance/class_hierarchy";
import { Tree } from "tree-sitter";
import { Language } from "@ariadnejs/types";

/**
 * Graph node representing a code entity
 */
export interface GraphNode {
  id: string;
  type: "function" | "class" | "module" | "variable" | "method" | "constructor";
  name: string;
  file_path: string;
  metadata: Record<string, any>;
}

/**
 * Graph edge representing a relationship
 */
export interface GraphEdge {
  id: string;
  type:
    | "calls"
    | "imports"
    | "exports"
    | "inherits"
    | "implements"
    | "uses"
    | "defines";
  source: string; // Node ID
  target: string; // Node ID
  metadata: Record<string, any>;
}

/**
 * Unified project graph
 */
export interface ProjectGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  modules: ModuleGraph;
  classes: ClassHierarchy;
  metadata: Record<string, any>;
}

/**
 * File analysis result
 */
export interface FileAnalysisResult {
  file_path: string;
  scopes: ScopeTree;
  imports: ImportInfo[];
  exports: ExportInfo[];
  function_calls: FunctionCallInfo[];
  method_calls: MethodCallInfo[];
  constructor_calls: ConstructorCallInfo[];
  types: Map<string, TypeInfo>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Graph builder configuration
 */
export interface GraphBuilderConfig {
  storage: StorageInterface;
  languages: Map<string, Language>;
  incremental?: boolean;
  parallel?: boolean;
}

/**
 * Graph builder context for passing between analysis phases
 */
interface BuildContext {
  storage: StorageInterface;
  languages: Map<string, Language>;
  file_analyses: Map<string, FileAnalysisResult>;
  module_graph: ModuleGraph;
  class_hierarchy: ClassHierarchy;
}

// TODO: Integration with Call Graph
// - Aggregate function calls into graph
// TODO: Integration with Module Graph
// - Create module dependency graph
// TODO: Integration with Class Hierarchy
// - Create class hierarchy graph

/**
 * Stub interface for future graph data structure integration
 * TODO: Replace with actual graph data structure implementation
 */
interface GraphBuilder<N, E> {
  add_node(node: N): void;
  add_edge(edge: E): void;
  build(): Graph<N, E>;
}

interface Graph<N, E> {
  nodes: Map<string, N>;
  edges: Map<string, E>;
}

/**
 * Analyze a single file
 */
export async function analyze_file(
  file: StoredFile,
  context: BuildContext
): Promise<FileAnalysisResult> {
  const metadata = {
    language: file.language,
    file_path: file.file_path,
  };

  // Phase 1: Build scope tree
  const scopes = build_scope_tree(file.tree!, metadata);

  // Phase 2: Detect imports and exports
  const imports = resolve_imports(file.tree!, metadata);
  const exports = detect_exports(file.tree!, metadata);

  // Phase 3: Track types
  const type_map = new Map<string, TypeInfo>();
  const types = track_variable_types(file.tree!, metadata);
  for (const type of types) {
    type_map.set(type.variable_name, type);
  }

  // Phase 4: Find function calls
  const function_calls = find_function_calls(file.tree!, metadata);
  const method_calls = find_method_calls(file.tree!, metadata);
  const constructor_calls = find_constructor_calls(file.tree!, metadata);

  // Phase 5: Build graph nodes and edges
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add function nodes from scope tree
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "function" || scope.type === "method") {
      const function_name = scope.metadata?.name;
      nodes.push({
        id: `${file.file_path}#${function_name}`,
        type: scope.type === "method" ? "method" : "function",
        name: function_name || "<anonymous>",
        file_path: file.file_path,
        metadata: {
          scope_id: scope.id,
          parent_scope: scope.parent_id,
        },
      });
    }
  }

  // Add class nodes
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "class") {
      const class_name = scope.metadata?.name;
      nodes.push({
        id: `${file.file_path}#class:${class_name}`,
        type: "class",
        name: class_name || "<anonymous>",
        file_path: file.file_path,
        metadata: {
          scope_id: scope.id,
        },
      });
    }
  }

  // Add module node
  nodes.push({
    id: `module:${file.file_path}`,
    type: "module",
    name: file.file_path,
    file_path: file.file_path,
    metadata: {
      language: file.language,
    },
  });

  // Add call edges
  for (const call of function_calls) {
    const source_id = `${file.file_path}#${
      call.caller_name || "<module>"
    }`;
    const target_id = `${file.file_path}#${call.callee_name}`;

    edges.push({
      id: `call:${source_id}->${target_id}`,
      type: "calls",
      source: source_id,
      target: target_id,
      metadata: {
        line: call.line,
        column: call.column,
        is_async: call.is_async,
      },
    });
  }

  // Add import edges
  for (const imp of imports) {
    const source_id = `module:${file.file_path}`;
    const target_id = `module:${imp.module_path}`;

    edges.push({
      id: `import:${source_id}->${target_id}`,
      type: "imports",
      source: source_id,
      target: target_id,
      metadata: {
        symbols: imp.imported_names,
        is_default: imp.is_default,
      },
    });
  }

  // Add export edges
  for (const exp of exports) {
    const source_id = `${file.file_path}#${exp.exported_name}`;
    const target_id = `module:${file.file_path}`;

    edges.push({
      id: `export:${source_id}->${target_id}`,
      type: "exports",
      source: source_id,
      target: target_id,
      metadata: {
        is_default: exp.is_default,
        original_name: exp.original_name,
      },
    });
  }

  return {
    file_path: file.file_path,
    scopes,
    imports,
    exports,
    function_calls,
    method_calls,
    constructor_calls,
    types: type_map,
    nodes,
    edges,
  };
}

/**
 * Build the complete project graph
 */
export async function build_project_graph(
  config: GraphBuilderConfig
): Promise<ProjectGraph> {
  // Initialize context
  const context: BuildContext = {
    storage: config.storage,
    languages: config.languages,
    file_analyses: new Map(),
    module_graph: {
      nodes: new Map(),
      edges: [],
      entry_points: new Set(),
      external_modules: new Set(),
    },
    class_hierarchy: {
      classes: new Map(),
      inheritance_edges: [],
    },
  };

  // Get all files from storage
  const state = await config.storage.get_state();
  const files = Array.from(state.files.values());

  // Phase 1: Analyze all files
  const analysis_promises = files.map((file) => analyze_file(file, context));
  const analyses = await Promise.all(analysis_promises);

  for (const analysis of analyses) {
    context.file_analyses.set(analysis.file_path, analysis);
  }

  // Phase 2: Build module graph
  const all_imports: ImportInfo[] = [];
  const all_exports: ExportInfo[] = [];

  for (const analysis of analyses) {
    all_imports.push(...analysis.imports);
    all_exports.push(...analysis.exports);
  }

  // Create metadata for module graph building
  const module_metadata = {
    language: "javascript" as Language, // TODO: Handle multi-language
    file_path: "",
  };

  context.module_graph = build_module_graph(
    all_imports,
    all_exports,
    module_metadata
  );

  // Phase 3: Build class hierarchy
  // TODO: Implement class hierarchy building
  // context.class_hierarchy = build_class_hierarchy(...);

  // Phase 4: Aggregate all nodes and edges
  const all_nodes = new Map<string, GraphNode>();
  const all_edges = new Map<string, GraphEdge>();

  for (const analysis of analyses) {
    for (const node of analysis.nodes) {
      all_nodes.set(node.id, node);
    }
    for (const edge of analysis.edges) {
      all_edges.set(edge.id, edge);
    }
  }

  // Phase 5: Cross-file edge resolution
  // TODO: Resolve cross-file references
  // - Match imports to exports
  // - Resolve cross-file function calls
  // - Link class inheritance across files

  return {
    nodes: all_nodes,
    edges: all_edges,
    modules: context.module_graph,
    classes: context.class_hierarchy,
    metadata: {
      file_count: files.length,
      node_count: all_nodes.size,
      edge_count: all_edges.size,
      build_time: Date.now(),
    },
  };
}

/**
 * Update graph for a single file (incremental update)
 */
export async function update_graph_for_file(
  file_path: string,
  config: GraphBuilderConfig,
  current_graph: ProjectGraph
): Promise<ProjectGraph> {
  // Get the updated file
  const state = await config.storage.get_state();
  const file = state.files.get(file_path);

  if (!file) {
    // File was deleted, remove its nodes and edges
    return remove_file_from_graph(file_path, current_graph);
  }

  // Create context with existing data
  const context: BuildContext = {
    storage: config.storage,
    languages: config.languages,
    file_analyses: new Map(),
    module_graph: current_graph.modules,
    class_hierarchy: current_graph.classes,
  };

  // Analyze the updated file
  const analysis = await analyze_file(file, context);

  // Remove old nodes and edges for this file
  const updated_graph = remove_file_from_graph(file_path, current_graph);

  // Add new nodes and edges
  for (const node of analysis.nodes) {
    updated_graph.nodes.set(node.id, node);
  }
  for (const edge of analysis.edges) {
    updated_graph.edges.set(edge.id, edge);
  }

  // Update metadata
  updated_graph.metadata.last_update = Date.now();
  updated_graph.metadata.node_count = updated_graph.nodes.size;
  updated_graph.metadata.edge_count = updated_graph.edges.size;

  // TODO: Update cross-file references affected by this change

  return updated_graph;
}

/**
 * Remove a file's contributions from the graph
 */
function remove_file_from_graph(
  file_path: string,
  graph: ProjectGraph
): ProjectGraph {
  const updated_nodes = new Map(graph.nodes);
  const updated_edges = new Map(graph.edges);

  // Remove nodes belonging to this file
  for (const [id, node] of updated_nodes) {
    if (node.file_path === file_path) {
      updated_nodes.delete(id);
    }
  }

  // Remove edges involving nodes from this file
  for (const [id, edge] of updated_edges) {
    if (edge.source.includes(file_path) || edge.target.includes(file_path)) {
      updated_edges.delete(id);
    }
  }

  return {
    ...graph,
    nodes: updated_nodes,
    edges: updated_edges,
  };
}

/**
 * Query the graph for specific patterns
 */
export function query_graph(
  graph: ProjectGraph,
  query: {
    node_type?: string;
    edge_type?: string;
    file_path?: string;
    name_pattern?: RegExp;
  }
): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const matching_nodes: GraphNode[] = [];
  const matching_edges: GraphEdge[] = [];

  // Filter nodes
  for (const node of graph.nodes.values()) {
    let matches = true;

    if (query.node_type && node.type !== query.node_type) {
      matches = false;
    }
    if (query.file_path && node.file_path !== query.file_path) {
      matches = false;
    }
    if (query.name_pattern && !query.name_pattern.test(node.name)) {
      matches = false;
    }

    if (matches) {
      matching_nodes.push(node);
    }
  }

  // Filter edges
  for (const edge of graph.edges.values()) {
    let matches = true;

    if (query.edge_type && edge.type !== query.edge_type) {
      matches = false;
    }

    if (matches) {
      matching_edges.push(edge);
    }
  }

  return {
    nodes: matching_nodes,
    edges: matching_edges,
  };
}
