/**
 * Module graph dispatcher
 * 
 * Main entry point for module dependency graph functionality
 */

import { Language } from '@ariadnejs/types';
import {
  ModuleNode,
  ImportInfo,
  ModuleEdge,
  ModuleGraph,
  ModuleGraphConfig,
  ModuleGraphContext,
  TypeEdge,
  ModuleResolver,
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance
} from './module_graph';

// Re-export all types and functions
export {
  ModuleNode,
  ImportInfo,
  ModuleEdge,
  ModuleGraph,
  ModuleGraphConfig,
  ModuleGraphContext,
  TypeEdge,
  ModuleResolver,
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance
};

/**
 * Create a module graph builder for a specific language
 * 
 * This is the main API for building module graphs
 */
export function create_module_graph_builder(
  language: Language,
  config: ModuleGraphConfig
): {
  add_file: (file_path: string) => void;
  remove_file: (file_path: string) => void;
  build: () => ModuleGraph;
  get_graph: () => ModuleGraph;
} {
  const files = new Set<string>();
  let cached_graph: ModuleGraph | null = null;
  
  return {
    add_file(file_path: string) {
      files.add(file_path);
      cached_graph = null;  // Invalidate cache
    },
    
    remove_file(file_path: string) {
      files.delete(file_path);
      cached_graph = null;  // Invalidate cache
    },
    
    build() {
      const context: ModuleGraphContext = {
        language,
        root_path: process.cwd(),  // TODO: Make configurable
        config
      };
      
      cached_graph = build_module_graph(Array.from(files), context);
      return cached_graph;
    },
    
    get_graph() {
      if (!cached_graph) {
        return this.build();
      }
      return cached_graph;
    }
  };
}

/**
 * Analyze module graph for issues
 */
export interface ModuleGraphAnalysis {
  circular_dependencies: string[][];
  unused_modules: string[];
  most_imported: Array<{ module: string; import_count: number }>;
  most_dependencies: Array<{ module: string; dependency_count: number }>;
  external_dependencies: string[];
  module_importance: Map<string, number>;
}

/**
 * Perform comprehensive analysis of a module graph
 */
export function analyze_module_graph(graph: ModuleGraph): ModuleGraphAnalysis {
  // Find circular dependencies
  const circular_dependencies = find_circular_dependencies(graph);
  
  // Find unused modules (no incoming edges and not entry points)
  const unused_modules: string[] = [];
  for (const [path, node] of graph.nodes) {
    if (!graph.entry_points.has(path)) {
      const incoming = graph.edges.filter(e => e.to === path);
      if (incoming.length === 0) {
        unused_modules.push(path);
      }
    }
  }
  
  // Find most imported modules
  const import_counts = new Map<string, number>();
  for (const edge of graph.edges) {
    import_counts.set(edge.to, (import_counts.get(edge.to) || 0) + 1);
  }
  const most_imported = Array.from(import_counts.entries())
    .map(([module, count]) => ({ module, import_count: count }))
    .sort((a, b) => b.import_count - a.import_count)
    .slice(0, 10);
  
  // Find modules with most dependencies
  const dependency_counts = new Map<string, number>();
  for (const [path] of graph.nodes) {
    const deps = get_module_dependencies(path, graph, false);
    dependency_counts.set(path, deps.size);
  }
  const most_dependencies = Array.from(dependency_counts.entries())
    .map(([module, count]) => ({ module, dependency_count: count }))
    .sort((a, b) => b.dependency_count - a.dependency_count)
    .slice(0, 10);
  
  // List external dependencies
  const external_dependencies = Array.from(graph.external_modules);
  
  // Calculate module importance
  const module_importance = calculate_module_importance(graph);
  
  return {
    circular_dependencies,
    unused_modules,
    most_imported,
    most_dependencies,
    external_dependencies,
    module_importance
  };
}

/**
 * Generate module graph visualization data
 * 
 * Returns data suitable for visualization libraries
 */
export interface ModuleGraphVisualization {
  nodes: Array<{
    id: string;
    label: string;
    group: string;  // Language or package
    size: number;   // Based on importance
    is_entry: boolean;
    is_external: boolean;
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    type: string;
  }>;
}

/**
 * Convert module graph to visualization format
 */
export function to_visualization_format(
  graph: ModuleGraph,
  analysis?: ModuleGraphAnalysis
): ModuleGraphVisualization {
  const importance = analysis?.module_importance || new Map();
  
  const nodes = Array.from(graph.nodes.entries()).map(([path, node]) => ({
    id: path,
    label: path.split('/').pop() || path,
    group: node.language,
    size: (importance.get(path) || 0.01) * 100,
    is_entry: graph.entry_points.has(path),
    is_external: node.is_external || false
  }));
  
  const edges = graph.edges.map(edge => ({
    source: edge.from,
    target: edge.to,
    weight: edge.weight || 1,
    type: edge.type
  }));
  
  return { nodes, edges };
}

/**
 * Export module graph to various formats
 */
export function export_module_graph(
  graph: ModuleGraph,
  format: 'json' | 'dot' | 'mermaid'
): string {
  switch (format) {
    case 'json':
      return export_as_json(graph);
    case 'dot':
      return export_as_dot(graph);
    case 'mermaid':
      return export_as_mermaid(graph);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export as JSON
 */
function export_as_json(graph: ModuleGraph): string {
  return JSON.stringify({
    nodes: Array.from(graph.nodes.entries()).map(([path, node]) => ({
      path,
      ...node
    })),
    edges: graph.edges,
    entry_points: Array.from(graph.entry_points),
    external_modules: Array.from(graph.external_modules)
  }, null, 2);
}

/**
 * Export as Graphviz DOT format
 */
function export_as_dot(graph: ModuleGraph): string {
  const lines: string[] = ['digraph ModuleGraph {'];
  
  // Add nodes
  for (const [path, node] of graph.nodes) {
    const label = path.split('/').pop() || path;
    const shape = graph.entry_points.has(path) ? 'box' : 'ellipse';
    const color = node.is_external ? 'gray' : 'black';
    lines.push(`  "${path}" [label="${label}", shape=${shape}, color=${color}];`);
  }
  
  // Add edges
  for (const edge of graph.edges) {
    const style = edge.type === 'namespace' ? 'dashed' : 'solid';
    lines.push(`  "${edge.from}" -> "${edge.to}" [style=${style}];`);
  }
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Export as Mermaid diagram
 */
function export_as_mermaid(graph: ModuleGraph): string {
  const lines: string[] = ['graph TD'];
  
  // Add nodes
  for (const [path, node] of graph.nodes) {
    const label = path.split('/').pop() || path;
    const shape = graph.entry_points.has(path) ? '[' : '(';
    const end_shape = graph.entry_points.has(path) ? ']' : ')';
    lines.push(`  ${path.replace(/[^a-zA-Z0-9]/g, '_')}${shape}"${label}"${end_shape}`);
  }
  
  // Add edges
  for (const edge of graph.edges) {
    const arrow = edge.type === 'namespace' ? '-..->' : '-->';
    const from_id = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
    const to_id = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
    lines.push(`  ${from_id} ${arrow} ${to_id}`);
  }
  
  return lines.join('\n');
}