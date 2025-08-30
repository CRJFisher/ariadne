/**
 * Module graph functionality
 *
 * Builds a graph showing import/export relationships between files.
 */

import {
  Language,
  ModuleNode,
  ModuleGraph,
  FilePath,
  ImportStatement,
  ExportStatement,
} from "@ariadnejs/types";

/**
 * Extended module node with additional metadata for graph building
 */
export interface ModuleNodeWithMetadata extends ModuleNode {
  readonly legacy_exports: ExportStatement[];
  readonly legacy_imports: ImportStatement[];
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
  readonly source_module: string; // Module being imported from
  readonly imported_names: readonly string[]; // Names being imported
  readonly is_namespace: boolean; // import * as ns
  readonly is_default: boolean; // import default
  readonly is_dynamic?: boolean; // Dynamic import()
  readonly location?: {
    readonly line: number;
    readonly column: number;
  };
}

/**
 * An edge in the module graph representing a dependency
 */
export interface ModuleEdge {
  readonly from: FilePath; // Source module file path
  readonly to: FilePath; // Target module file path
  readonly type: "import" | "export" | "namespace" | "dynamic" | "type";
  readonly imports: readonly string[]; // What is imported
  readonly weight?: number; // Number of imports (for visualization)
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
  files: Map<
    FilePath,
    {
      file_path: FilePath;
      language: Language;
      imports: readonly ImportStatement[];
      exports: readonly ExportStatement[];
    }
  >,
  options: ModuleGraphOptions = {}
): ModuleGraphWithEdges {
  const graph: ModuleGraphWithEdges = {
    modules: new Map(),
    edges: [],
    entry_points: new Set(),
    external_modules: new Set(),
    dependency_order: [],
  };

  // First pass: Create nodes for all files
  for (const [file_path, analysis] of Array.from(files)) {
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
  for (const [, node] of Array.from(graph.modules)) {
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
    imports: ImportStatement[];
    exports: ExportStatement[];
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
    legacy_imports,
  } as ModuleNodeWithMetadata;
}

/**
 * Convert import resolution info to module import info
 */
function convert_to_module_imports(
  imports: ImportStatement[],
  _file_path: FilePath
): ModuleImportInfo[] {
  const module_imports: ModuleImportInfo[] = [];

  // Group imports by source module
  const by_module = new Map<string, ImportStatement[]>();
  for (const imp of imports) {
    // For now, use a placeholder since ImportedSymbol doesn't have source_module
    // TODO: Update when ImportResolutionInfo is properly migrated
    const source = "unknown_module";
    if (!by_module.has(source)) {
      by_module.set(source, []);
    }
    by_module.get(source)!.push(imp);
  }

  // Create ModuleImportInfo for each module
  for (const [source_module, imports_from_module] of Array.from(by_module)) {
    if (!source_module) continue; // Skip empty sources

    const info: ModuleImportInfo = {
      source_module,
      imported_names: imports_from_module.map((i) => i.local_name),
      is_namespace: imports_from_module.some(
        (i) => i.import_statement?.is_namespace === true
      ),
      is_default: imports_from_module.some(
        (i) => i.import_statement?.is_default === true
      ),
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
      weight: imp.imported_names.length,
    };

    edges.push(edge);
  }

  return edges;
}

/**
 * Resolve a module import path (simplified for now)
 */
function resolve_module_path(
  _from_file: FilePath,
  import_path: string
): FilePath {
  // TODO: Implement proper module resolution
  // For now, just return the import path as-is
  return import_path;
}

/**
 * Determine the type of edge based on import
 */
function determine_edge_type(imp: ModuleImportInfo): ModuleEdge["type"] {
  if (imp.is_namespace) return "namespace";
  if (imp.is_dynamic) return "dynamic";
  // TODO: Detect type imports when integrated with type tracking
  return "import";
}

/**
 * Check if a file is an entry point
 */
function is_entry_point(file_path: FilePath): boolean {
  // TODO: make language-specific
  // Common entry point patterns
  const entry_patterns = [
    /index\.(js|ts|jsx|tsx)$/,
    /main\.(js|ts|py|rs)$/,
    /app\.(js|ts|jsx|tsx)$/,
    /__main__\.py$/,
    /lib\.rs$/,
    /mod\.rs$/,
  ];

  return entry_patterns.some((pattern) => pattern.test(file_path));
}

/**
 * Check if a module is external
 */
function is_external_module(module_path: string): boolean {
  // TODO: make language-specific
  // Check for common external module patterns
  if (module_path.includes("node_modules")) return true;
  if (module_path.includes("site-packages")) return true; // Python
  if (module_path.startsWith("std::")) return true; // Rust std lib
  if (!module_path.startsWith(".") && !module_path.startsWith("/")) {
    // Non-relative imports are usually external
    return true;
  }
  return false;
}
