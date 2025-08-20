/**
 * Common module graph logic
 * 
 * Provides functionality for building and analyzing module dependency graphs
 * showing import/export relationships between files.
 */

// TODO: Integration with Import Resolution
// - Add import edges to graph
// TODO: Integration with Export Detection
// - Add export nodes to graph
// TODO: Integration with Namespace Resolution
// - Special edge type for namespace imports

import { Language, ScopeGraph, Def, Import } from '@ariadnejs/types';
import { ExportInfo } from '../export_detection';

/**
 * A node in the module graph representing a single module/file
 */
export interface ModuleNode {
  file_path: string;
  language: Language;
  exports: ExportInfo[];
  imports: ImportInfo[];
  is_entry_point?: boolean;
  is_external?: boolean;  // External dependency (node_modules, etc.)
  metadata?: {
    package_name?: string;
    version?: string;
    size?: number;
    last_modified?: Date;
  };
}

/**
 * Information about an import in a module
 */
export interface ImportInfo {
  source_module: string;  // Module being imported from
  imported_names: string[];  // Names being imported
  is_namespace: boolean;  // import * as ns
  is_default: boolean;  // import default
  is_dynamic?: boolean;  // Dynamic import()
  location?: {
    line: number;
    column: number;
  };
}

/**
 * An edge in the module graph representing a dependency
 */
export interface ModuleEdge {
  from: string;  // Source module file path
  to: string;    // Target module file path
  type: 'import' | 'export' | 'namespace' | 'dynamic' | 'type';
  imports: string[];  // What is imported
  weight?: number;  // Number of imports (for visualization)
}

/**
 * The complete module dependency graph
 */
export interface ModuleGraph {
  nodes: Map<string, ModuleNode>;
  edges: ModuleEdge[];
  entry_points: Set<string>;
  external_modules: Set<string>;
}

/**
 * Configuration for building module graphs
 */
export interface ModuleGraphConfig {
  get_scope_graph: (file_path: string) => ScopeGraph | undefined;
  get_exports?: (file_path: string) => ExportInfo[];
  get_imports?: (file_path: string) => Import[];
  resolve_module_path?: (from: string, import_path: string) => string | undefined;
  include_external?: boolean;
  include_type_imports?: boolean;
  debug?: boolean;
}

/**
 * Context for module graph operations
 */
export interface ModuleGraphContext {
  language: Language;
  root_path: string;
  config: ModuleGraphConfig;
}

// TODO: Add these stub interfaces for future integration

// Integration with type propagation
export interface TypeEdge extends ModuleEdge {
  type: 'type';
  type_info: any;  // TODO: Define TypeInfo structure
}

// Integration with module resolution
export interface ModuleResolver {
  resolve_path(from: string, to: string): string | undefined;
  is_external(path: string): boolean;
  get_package_info(path: string): { name: string; version: string } | undefined;
}

/**
 * Build a module graph from a set of files
 */
export function build_module_graph(
  file_paths: string[],
  context: ModuleGraphContext
): ModuleGraph {
  const graph: ModuleGraph = {
    nodes: new Map(),
    edges: [],
    entry_points: new Set(),
    external_modules: new Set()
  };
  
  // First pass: Create nodes for all files
  for (const file_path of file_paths) {
    const node = create_module_node(file_path, context);
    if (node) {
      graph.nodes.set(file_path, node);
      
      // Check if it's an entry point
      if (is_entry_point(file_path, context)) {
        graph.entry_points.add(file_path);
      }
    }
  }
  
  // Second pass: Create edges based on imports/exports
  for (const [file_path, node] of graph.nodes) {
    const edges = create_module_edges(node, graph, context);
    graph.edges.push(...edges);
    
    // Track external modules
    for (const imp of node.imports) {
      if (is_external_module(imp.source_module, context)) {
        graph.external_modules.add(imp.source_module);
      }
    }
  }
  
  return graph;
}

/**
 * Create a module node from a file
 */
function create_module_node(
  file_path: string,
  context: ModuleGraphContext
): ModuleNode | undefined {
  const { config } = context;
  
  const scope_graph = config.get_scope_graph(file_path);
  if (!scope_graph) {
    if (config.debug) {
      console.log(`No scope graph for ${file_path}`);
    }
    return undefined;
  }
  
  // Get exports (TODO: integrate with export_detection)
  const exports = config.get_exports?.(file_path) || [];
  
  // Get imports and convert to ImportInfo
  const raw_imports = config.get_imports?.(file_path) || scope_graph.getAllImports();
  const imports = convert_to_import_info(raw_imports, file_path, context);
  
  return {
    file_path,
    language: detect_language(file_path),
    exports,
    imports
  };
}

/**
 * Convert raw imports to ImportInfo
 */
function convert_to_import_info(
  imports: Import[],
  file_path: string,
  context: ModuleGraphContext
): ImportInfo[] {
  const import_infos: ImportInfo[] = [];
  const { config } = context;
  
  // Group imports by source module
  const by_module = new Map<string, Import[]>();
  for (const imp of imports) {
    const source = imp.source_module || '';
    if (!by_module.has(source)) {
      by_module.set(source, []);
    }
    by_module.get(source)!.push(imp);
  }
  
  // Create ImportInfo for each module
  for (const [source_module, module_imports] of by_module) {
    const resolved_path = config.resolve_module_path?.(file_path, source_module) || source_module;
    
    const info: ImportInfo = {
      source_module: resolved_path,
      imported_names: module_imports.map(i => i.name),
      is_namespace: module_imports.some(i => i.source_name === '*'),
      is_default: module_imports.some(i => i.name === 'default')
    };
    
    import_infos.push(info);
  }
  
  return import_infos;
}

/**
 * Create edges from a module node
 */
function create_module_edges(
  node: ModuleNode,
  graph: ModuleGraph,
  context: ModuleGraphContext
): ModuleEdge[] {
  const edges: ModuleEdge[] = [];
  
  for (const imp of node.imports) {
    // Check if target module is in the graph
    const target_node = graph.nodes.get(imp.source_module);
    if (!target_node && !context.config.include_external) {
      continue;
    }
    
    const edge: ModuleEdge = {
      from: node.file_path,
      to: imp.source_module,
      type: determine_edge_type(imp),
      imports: imp.imported_names,
      weight: imp.imported_names.length
    };
    
    edges.push(edge);
  }
  
  return edges;
}

/**
 * Determine the type of edge based on import
 */
function determine_edge_type(imp: ImportInfo): ModuleEdge['type'] {
  if (imp.is_namespace) return 'namespace';
  if (imp.is_dynamic) return 'dynamic';
  // TODO: Detect type imports when integrated with type tracking
  return 'import';
}

/**
 * Check if a file is an entry point
 */
function is_entry_point(file_path: string, context: ModuleGraphContext): boolean {
  // Common entry point patterns
  const entry_patterns = [
    /index\.(js|ts|jsx|tsx)$/,
    /main\.(js|ts|py|rs)$/,
    /app\.(js|ts|jsx|tsx)$/,
    /__main__\.py$/,
    /lib\.rs$/,
    /mod\.rs$/
  ];
  
  return entry_patterns.some(pattern => pattern.test(file_path));
}

/**
 * Check if a module is external
 */
function is_external_module(module_path: string, context: ModuleGraphContext): boolean {
  // Check for common external module patterns
  if (module_path.includes('node_modules')) return true;
  if (module_path.includes('site-packages')) return true;  // Python
  if (module_path.startsWith('std::')) return true;  // Rust std lib
  if (!module_path.startsWith('.') && !module_path.startsWith('/')) {
    // Non-relative imports are usually external
    return true;
  }
  return false;
}

/**
 * Detect language from file extension
 */
function detect_language(file_path: string): Language {
  if (file_path.endsWith('.ts') || file_path.endsWith('.tsx')) return 'typescript';
  if (file_path.endsWith('.js') || file_path.endsWith('.jsx')) return 'javascript';
  if (file_path.endsWith('.py')) return 'python';
  if (file_path.endsWith('.rs')) return 'rust';
  return 'javascript';  // Default
}

/**
 * Find circular dependencies in the module graph
 */
export function find_circular_dependencies(graph: ModuleGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const rec_stack = new Set<string>();
  const path: string[] = [];
  
  function dfs(node: string): void {
    visited.add(node);
    rec_stack.add(node);
    path.push(node);
    
    // Find edges from this node
    const outgoing = graph.edges.filter(e => e.from === node);
    
    for (const edge of outgoing) {
      if (!visited.has(edge.to)) {
        dfs(edge.to);
      } else if (rec_stack.has(edge.to)) {
        // Found a cycle
        const cycle_start = path.indexOf(edge.to);
        if (cycle_start >= 0) {
          cycles.push([...path.slice(cycle_start), edge.to]);
        }
      }
    }
    
    path.pop();
    rec_stack.delete(node);
  }
  
  // Check all nodes
  for (const node of graph.nodes.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  return cycles;
}

/**
 * Get all dependencies of a module (transitive)
 */
export function get_module_dependencies(
  module_path: string,
  graph: ModuleGraph,
  include_transitive: boolean = true
): Set<string> {
  const dependencies = new Set<string>();
  const to_visit = [module_path];
  const visited = new Set<string>();
  
  while (to_visit.length > 0) {
    const current = to_visit.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Find all edges from current module
    const edges = graph.edges.filter(e => e.from === current);
    
    for (const edge of edges) {
      dependencies.add(edge.to);
      if (include_transitive && !visited.has(edge.to)) {
        to_visit.push(edge.to);
      }
    }
  }
  
  return dependencies;
}

/**
 * Get all modules that depend on a given module
 */
export function get_module_dependents(
  module_path: string,
  graph: ModuleGraph,
  include_transitive: boolean = true
): Set<string> {
  const dependents = new Set<string>();
  const to_visit = [module_path];
  const visited = new Set<string>();
  
  while (to_visit.length > 0) {
    const current = to_visit.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Find all edges to current module
    const edges = graph.edges.filter(e => e.to === current);
    
    for (const edge of edges) {
      dependents.add(edge.from);
      if (include_transitive && !visited.has(edge.from)) {
        to_visit.push(edge.from);
      }
    }
  }
  
  return dependents;
}

/**
 * Calculate module importance (PageRank-like)
 */
export function calculate_module_importance(graph: ModuleGraph): Map<string, number> {
  const importance = new Map<string, number>();
  const damping = 0.85;
  const iterations = 50;
  
  // Initialize all nodes with equal importance
  const num_nodes = graph.nodes.size;
  for (const node of graph.nodes.keys()) {
    importance.set(node, 1 / num_nodes);
  }
  
  // Iteratively update importance
  for (let i = 0; i < iterations; i++) {
    const new_importance = new Map<string, number>();
    
    for (const node of graph.nodes.keys()) {
      // Find incoming edges
      const incoming = graph.edges.filter(e => e.to === node);
      
      let sum = 0;
      for (const edge of incoming) {
        const from_importance = importance.get(edge.from) || 0;
        const outgoing_count = graph.edges.filter(e => e.from === edge.from).length;
        sum += from_importance / outgoing_count;
      }
      
      new_importance.set(node, (1 - damping) / num_nodes + damping * sum);
    }
    
    // Update importance
    for (const [node, value] of new_importance) {
      importance.set(node, value);
    }
  }
  
  return importance;
}