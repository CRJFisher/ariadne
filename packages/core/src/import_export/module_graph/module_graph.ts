/**
 * Module graph functionality
 * 
 * Builds a graph showing import/export relationships between files.
 */

import { Language } from '@ariadnejs/types';
import { ExportInfo } from '../export_detection';
import { ImportInfo as ImportResolutionInfo } from '../import_resolution';

/**
 * A node in the module graph representing a single module/file
 */
export interface ModuleNode {
  file_path: string;
  language: Language;
  exports: ExportInfo[];
  imports: ModuleImportInfo[];
  is_entry_point?: boolean;
  is_external?: boolean;
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
export interface ModuleImportInfo {
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
 * Options for building module graph
 */
export interface ModuleGraphOptions {
  root_path?: string;
  include_external?: boolean;
}

/**
 * Build a module graph from analyzed files
 */
export function build_module_graph(
  files: Map<string, {
    file_path: string;
    language: Language;
    imports: ImportResolutionInfo[];
    exports: ExportInfo[];
  }>,
  options: ModuleGraphOptions = {}
): ModuleGraph {
  const graph: ModuleGraph = {
    nodes: new Map(),
    edges: [],
    entry_points: new Set(),
    external_modules: new Set()
  };
  
  // First pass: Create nodes for all files
  for (const [file_path, analysis] of files) {
    const node = create_module_node(file_path, analysis);
    if (node) {
      graph.nodes.set(file_path, node);
      
      // Check if it's an entry point
      if (is_entry_point(file_path)) {
        graph.entry_points.add(file_path);
      }
    }
  }
  
  // Second pass: Create edges based on imports
  for (const [file_path, node] of graph.nodes) {
    const edges = create_module_edges(node, graph, options);
    graph.edges.push(...edges);
    
    // Track external modules
    for (const imp of node.imports) {
      if (is_external_module(imp.source_module)) {
        graph.external_modules.add(imp.source_module);
      }
    }
  }
  
  return graph;
}

/**
 * Create a module node from analyzed file data
 */
function create_module_node(
  file_path: string,
  analysis: {
    language: Language;
    imports: ImportResolutionInfo[];
    exports: ExportInfo[];
  }
): ModuleNode {
  // Convert ImportResolutionInfo to ModuleImportInfo
  const imports = convert_to_module_imports(analysis.imports, file_path);
  
  return {
    file_path,
    language: analysis.language,
    exports: analysis.exports,
    imports
  };
}

/**
 * Convert import resolution info to module import info
 */
function convert_to_module_imports(
  imports: ImportResolutionInfo[],
  file_path: string
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
  node: ModuleNode,
  graph: ModuleGraph,
  options: ModuleGraphOptions
): ModuleEdge[] {
  const edges: ModuleEdge[] = [];
  
  for (const imp of node.imports) {
    // Resolve the module path (for now just use as-is)
    const resolved_path = resolve_module_path(node.file_path, imp.source_module);
    
    // Check if target module is in the graph
    const target_node = graph.nodes.get(resolved_path);
    if (!target_node && !options.include_external) {
      continue;
    }
    
    const edge: ModuleEdge = {
      from: node.file_path,
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
function resolve_module_path(from_file: string, import_path: string): string {
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
function is_entry_point(file_path: string): boolean {
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