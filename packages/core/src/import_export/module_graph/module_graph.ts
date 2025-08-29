/**
 * Module graph functionality
 * 
 * Builds a graph showing import/export relationships between files.
 */

import { Language, ModuleNode, ModuleGraph, ImportedSymbol, ExportedSymbol, ImportedModule } from '@ariadnejs/types';
import { FilePath, ModulePath } from '@ariadnejs/types';
import { ExportInfo } from '../export_detection';
import { ImportInfo as ImportResolutionInfo } from '../import_resolution';

/**
 * Extended module node with additional metadata for graph building
 */
export interface ModuleNodeWithMetadata extends Omit<ModuleNode, 'imports' | 'exports'> {
  readonly legacy_exports: ExportInfo[];
  readonly legacy_imports: ModuleImportInfo[];
  readonly is_entry_point?: boolean;
  readonly is_external?: boolean;
  readonly metadata?: {
    readonly package_name?: string;
    readonly version?: string;
    readonly size?: number;
    readonly last_modified?: Date;
  };
}

/**
 * Legacy import information for compatibility
 */
export interface ModuleImportInfo {
  readonly source_module: string;  // Module being imported from
  readonly imported_names: readonly string[];  // Names being imported
  readonly is_namespace: boolean;  // import * as ns
  readonly is_default: boolean;  // import default
  readonly is_dynamic?: boolean;  // Dynamic import()
  readonly location?: {
    readonly line: number;
    readonly column: number;
  };
}

/**
 * An edge in the module graph representing a dependency
 */
export interface ModuleEdge {
  readonly from: FilePath;  // Source module file path
  readonly to: FilePath;    // Target module file path
  readonly type: 'import' | 'export' | 'namespace' | 'dynamic' | 'type';
  readonly imports: readonly string[];  // What is imported
  readonly weight?: number;  // Number of imports (for visualization)
}

/**
 * Extended module graph with edges and metadata
 */
export interface ModuleGraphWithEdges extends ModuleGraph {
  readonly edges: readonly ModuleEdge[];
  readonly external_modules: ReadonlySet<FilePath>;
}

/**
 * Options for building module graph
 */
export interface ModuleGraphOptions {
  readonly root_path?: string;
  readonly include_external?: boolean;
}

/**
 * Build a module graph from analyzed files
 */
export function build_module_graph(
  files: Map<FilePath, {
    file_path: FilePath;
    language: Language;
    imports: ImportResolutionInfo[];
    exports: ExportInfo[];
  }>,
  options: ModuleGraphOptions = {}
): ModuleGraphWithEdges {
  const graph: ModuleGraphWithEdges = {
    modules: new Map(),
    edges: [],
    entry_points: new Set(),
    external_modules: new Set(),
    dependency_order: []
  };
  
  // First pass: Create nodes for all files
  for (const [file_path, analysis] of files) {
    const node = create_module_node(file_path, analysis);
    if (node) {
      (graph.modules as Map<FilePath, ModuleNode>).set(file_path, node);
      
      // Check if it's an entry point
      if (is_entry_point(file_path)) {
        (graph.entry_points as Set<FilePath>).add(file_path);
      }
    }
  }
  
  // Second pass: Create edges based on imports
  for (const [file_path, node] of graph.modules) {
    const nodeWithMetadata = node as ModuleNodeWithMetadata;
    const edges = create_module_edges(nodeWithMetadata, graph, options);
    (graph.edges as ModuleEdge[]).push(...edges);
    
    // Track external modules
    for (const imp of nodeWithMetadata.legacy_imports || []) {
      if (is_external_module(imp.source_module)) {
        (graph.external_modules as Set<FilePath>).add(imp.source_module);
      }
    }
  }
  
  return graph;
}

/**
 * Create a module node from analyzed file data
 */
function create_module_node(
  file_path: FilePath,
  analysis: {
    language: Language;
    imports: ImportResolutionInfo[];
    exports: ExportInfo[];
  }
): ModuleNodeWithMetadata {
  // Convert ImportResolutionInfo to ModuleImportInfo
  const legacy_imports = convert_to_module_imports(analysis.imports, file_path);
  
  return {
    path: file_path,
    imports: new Map(), // TODO: Convert to new ImportedModule format
    exports: new Map(), // TODO: Convert to new ExportedSymbol format
    imported_by: new Set(),
    language: analysis.language,
    legacy_exports: analysis.exports,
    legacy_imports
  };
}

/**
 * Convert import resolution info to module import info
 */
function convert_to_module_imports(
  imports: ImportResolutionInfo[],
  file_path: FilePath
): ModuleImportInfo[] {
  const module_imports: ModuleImportInfo[] = [];
  
  // Group imports by source module
  const by_module = new Map<string, ImportResolutionInfo[]>();
  for (const imp of imports) {
    const source = imp.import_statement?.source_module || '';
    if (!by_module.has(source)) {
      by_module.set(source, []);
    }
    by_module.get(source)!.push(imp);
  }
  
  // Create ModuleImportInfo for each module
  for (const [source_module, imports_from_module] of by_module) {
    if (!source_module) continue;  // Skip empty sources
    
    const info: ModuleImportInfo = {
      source_module,
      imported_names: imports_from_module.map(i => i.local_name),
      is_namespace: imports_from_module.some(i => i.import_statement?.source_name === '*'),
      is_default: imports_from_module.some(i => i.local_name === 'default')
    };
    
    module_imports.push(info);
  }
  
  return module_imports;
}

/**
 * Create edges from a module node
 */
function create_module_edges(
  node: ModuleNodeWithMetadata,
  graph: ModuleGraphWithEdges,
  options: ModuleGraphOptions
): ModuleEdge[] {
  const edges: ModuleEdge[] = [];
  
  for (const imp of node.legacy_imports || []) {
    // Resolve the module path (for now just use as-is)
    const resolved_path = resolve_module_path(node.path, imp.source_module);
    
    // Check if target module is in the graph
    const target_node = graph.modules.get(resolved_path);
    if (!target_node && !options.include_external) {
      continue;
    }
    
    const edge: ModuleEdge = {
      from: node.path,
      to: resolved_path,
      type: determine_edge_type(imp),
      imports: imp.imported_names,
      weight: imp.imported_names.length
    };
    
    edges.push(edge);
  }
  
  return edges;
}

/**
 * Resolve a module import path (simplified for now)
 */
function resolve_module_path(from_file: FilePath, import_path: string): FilePath {
  // TODO: Implement proper module resolution
  // For now, just return the import path as-is
  return import_path;
}

/**
 * Determine the type of edge based on import
 */
function determine_edge_type(imp: ModuleImportInfo): ModuleEdge['type'] {
  if (imp.is_namespace) return 'namespace';
  if (imp.is_dynamic) return 'dynamic';
  // TODO: Detect type imports when integrated with type tracking
  return 'import';
}

/**
 * Check if a file is an entry point
 */
function is_entry_point(file_path: FilePath): boolean {
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
function is_external_module(module_path: string): boolean {
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
 * Find circular dependencies in the module graph
 */
export function find_circular_dependencies(_graph: ModuleGraphWithEdges): FilePath[][] {
  // TODO: Implement cycle detection algorithm
  return [];
}

/**
 * Get all dependencies of a module
 */
export function get_module_dependencies(graph: ModuleGraphWithEdges, module_path: FilePath): FilePath[] {
  const dependencies: FilePath[] = [];
  for (const edge of graph.edges) {
    if (edge.from === module_path) {
      dependencies.push(edge.to);
    }
  }
  return dependencies;
}

/**
 * Get all dependents of a module (modules that depend on this one)
 */
export function get_module_dependents(graph: ModuleGraphWithEdges, module_path: FilePath): FilePath[] {
  const dependents: FilePath[] = [];
  for (const edge of graph.edges) {
    if (edge.to === module_path) {
      dependents.push(edge.from);
    }
  }
  return dependents;
}

/**
 * Calculate importance score of a module based on dependencies
 */
export function calculate_module_importance(graph: ModuleGraphWithEdges, module_path: FilePath): number {
  const dependents = get_module_dependents(graph, module_path);
  const dependencies = get_module_dependencies(graph, module_path);
  
  // Simple scoring: more dependents = more important, more dependencies = less independent
  return dependents.length - dependencies.length * 0.1;
}

/**
 * Create a module graph builder (placeholder for compatibility)
 */
export function create_module_graph_builder() {
  // TODO: Implement builder pattern if needed
  return {
    build: build_module_graph
  };
}

/**
 * Analyze module graph and return analysis results
 */
export function analyze_module_graph(graph: ModuleGraphWithEdges) {
  return {
    total_modules: graph.modules.size,
    entry_points: graph.entry_points.size,
    external_modules: graph.external_modules.size,
    circular_dependencies: find_circular_dependencies(graph),
    most_important_modules: Array.from(graph.modules.keys())
      .map(path => ({ path, importance: calculate_module_importance(graph, path) }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10)
  };
}