/**
 * Code Graph Generation
 *
 * Main entry point for analyzing a codebase and generating a comprehensive code graph.
 */

import { analyze_file } from "./file_analyzer";
import { build_module_graph } from "./import_export/module_graph";
import { TypeRegistry } from "./type_analysis/type_registry";
import { build_type_registry } from "./type_analysis/type_registry/type_registry";
import {
  Language,
  // Main types
  CodeGraph,
  CodeGraphOptions,
  FileAnalysis,
  ImportStatement,
  ExportStatement,
  ImportInfo,
  ExportInfo,
  // Common types
  Location,
  FunctionDefinition,
  FunctionSignature,
  ParameterType,
  TypeParameter,
  VariableDeclaration,
  AnalysisError,
  // Module types
  ModuleGraph,
  NamespaceInfo,
  NamespaceExportInfo,
  ResolvedNamespaceType,
  // Call types
  CallGraph,
  FunctionNode,
  CallEdge,
  ResolvedCall,
  CallChain,
  // Type types
  TypeIndex,
  VariableType,
  TypeDefinition,
  TypeGraph,
  TypeEdge,
  // Symbol types
  SymbolIndex,
  SymbolDefinition,
  Usage,
  ExportedSymbol,
  ResolvedSymbol,
  // Class types
  ClassHierarchy,
  MethodNode,
  SymbolId,
  FilePath,
  TypeKind,
} from "@ariadnejs/types";
import type { ClassDefinition } from "@ariadnejs/types";
import {
  build_class_hierarchy,
  type ClassHierarchyContext,
} from "./inheritance/class_hierarchy";
import {
  InterfaceImplementation,
  InterfaceDefinition,
  build_interface_implementation_map,
  find_interface_implementations,
} from "./inheritance/interface_implementation";
import {
  analyze_overrides_with_hierarchy,
  MethodOverrideMap,
  find_overriding_methods,
  find_overridden_method,
} from "./inheritance/method_override";
import {
  AnalysisCache,
  createAnalysisCache,
  CacheOptions,
} from "./cache/analysis_cache";
import {
  scan_files,
  read_and_parse_file,
  CodeFile,
} from "./project/file_scanner";
import type { SyntaxNode } from "tree-sitter";
import {
  construct_symbol,
  construct_function_symbol,
  construct_class_symbol,
  construct_method_symbol,
  construct_variable_symbol,
  SPECIAL_SYMBOLS,
} from "./utils";
import {
  build_scope_path,
  build_full_scope_path,
  get_parent_scope_name,
  find_containing_class,
} from "./utils";
import {
  enrich_all_calls,
  EnrichmentContext,
  EnrichmentOptions,
  EnrichedFileAnalysis,
} from "./call_graph/enrichment";
import { build_call_chains } from "./call_graph/call_chain_analysis";
import {
  build_symbol_table,
  GlobalSymbolTable,
} from "./scope_analysis/symbol_resolution";
import {
  build_scope_entity_connections,
  ScopeEntityConnections,
} from "./scope_analysis/scope_entity_connections";
import { resolve_all_symbols } from "./scope_analysis/symbol_resolution";
import { resolve_generics_across_files } from "./type_analysis/generic_resolution";
import { propagate_types_across_files } from "./type_analysis/type_propagation";
import {
  resolve_namespace_exports,
  resolve_namespace_member,
  analyze_namespace,
  is_namespace_import,
  NamespaceImportInfo,
  NamespaceExport,
  NamespaceResolutionContext,
} from "./import_export/namespace_resolution";
import { find_member_access_expressions } from "./ast/member_access";
import Parser from "tree-sitter";

/**
 * Resolve namespace imports and their members across all files
 *
 * This function identifies namespace imports, resolves their exported members,
 * and tracks namespace member access patterns across the codebase.
 */
async function resolve_namespaces_across_files(
  analyses: FileAnalysis[],
  module_graph: ModuleGraph,
  type_registry: TypeRegistry,
  propagated_types: any,
  file_name_to_tree: Map<FilePath, Parser.Tree>
): Promise<Map<string, NamespaceInfo>> {
  const namespace_map = new Map<string, NamespaceInfo>();
  const resolved_members = new Map<Location, ResolvedNamespaceType>();

  // Build namespace import map from all files
  for (const analysis of analyses) {
    for (const import_stmt of analysis.imports) {
      // Check if this is a namespace import
      if (import_stmt.is_namespace_import && import_stmt.namespace_name) {
        const namespace_key = `${analysis.file_path}:${import_stmt.namespace_name}`;

        // Get the exported members from the source module
        const source_module_path = resolveModulePath(
          import_stmt.source,
          analysis.file_path,
          module_graph
        );

        if (source_module_path) {
          const source_analysis = analyses.find(
            (a) => a.file_path === source_module_path
          );
          if (source_analysis) {
            const namespace_exports = collectNamespaceExports(source_analysis);

            namespace_map.set(namespace_key, {
              name: import_stmt.namespace_name,
              source: import_stmt.source,
              source_path: source_module_path,
              exports: namespace_exports,
              location: import_stmt.location,
              file_path: analysis.file_path,
            });
          }
        }
      }
    }
  }

  // Resolve namespace member accesses
  for (const analysis of analyses) {
    // Get the AST for this file
    const tree = file_name_to_tree.get(analysis.file_path);
    if (!tree) continue;

    // Find member access expressions in the AST
    const member_accesses = find_member_access_expressions(
      analysis,
      tree.rootNode
    );

    for (const access of member_accesses) {
      const namespace_key = `${analysis.file_path}:${access.namespace}`;
      const namespace_info = namespace_map.get(namespace_key);

      if (namespace_info) {
        const resolved_member = namespace_info.exports.get(access.member);
        if (resolved_member) {
          resolved_members.set(access.location, {
            name: access.member,
            qualified_name: `${access.namespace}.${access.member}`,
            source_module: namespace_info.source_path,
            kind: resolved_member.kind,
            location: resolved_member.location,
          });
        }
      }
    }
  }

  // Note: Type registry is now immutable, namespace-qualified types
  // should be handled during the registry build phase if needed

  return namespace_map;
}

// Helper function to resolve module paths
function resolveModulePath(
  source: string,
  from_file: FilePath,
  module_graph: ModuleGraph
): string | undefined {
  // Check if it's a relative import
  if (source.startsWith("./") || source.startsWith("../")) {
    // Resolve relative to the importing file
    const base_dir = from_file.substring(0, from_file.lastIndexOf("/"));
    return normalizeModulePath(`${base_dir}/${source}`);
  }

  // Check module graph for absolute imports
  for (const [path, module_info] of module_graph.modules) {
    if (module_info.path === source || path.endsWith(source)) {
      return path;
    }
  }

  return undefined;
}

// Helper function to normalize module paths
function normalizeModulePath(path: string): string {
  // Remove .ts, .js, .tsx, .jsx extensions
  const normalized = path.replace(/\.(ts|js|tsx|jsx)$/, "");

  // Resolve .. and . in the path
  const parts = normalized.split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }

  return resolved.join("/");
}

// Helper function to collect namespace exports
function collectNamespaceExports(
  analysis: FileAnalysis
): Map<string, NamespaceExportInfo> {
  const exports = new Map<string, NamespaceExportInfo>();

  // Collect named exports
  for (const export_stmt of analysis.exports) {
    if (export_stmt.symbol_name && !export_stmt.is_default) {
      exports.set(export_stmt.symbol_name, {
        name: export_stmt.symbol_name,
        kind: "export",
        location: export_stmt.location,
      });
    }
  }

  // Collect exported functions
  for (const func of analysis.functions) {
    exports.set(func.name, {
      name: func.name,
      kind: "function",
      location: func.location,
    });
  }

  // Collect exported classes
  for (const cls of analysis.classes) {
    exports.set(cls.name, {
      name: cls.name,
      kind: "class",
      location: cls.location,
    });
  }

  return exports;
}

/**
 * Generate a comprehensive code graph from a codebase
 *
 * This is the main entry point for code analysis. It scans the specified
 * directory, analyzes all matching files, and builds a complete graph
 * representing the code structure and relationships.
 *
 * @param options Configuration for code graph generation
 * @returns A complete code graph of the analyzed codebase
 *
 * @example
 * const graph = await generate_code_graph({
 *   root_path: "/path/to/project",
 *   include_patterns: ["src/**.ts"],
 *   exclude_patterns: ["**.test.ts"]
 * });
 */
export async function generate_code_graph(
  options: CodeGraphOptions
): Promise<CodeGraph> {
  const start_time = Date.now();

  // Create cache if enabled
  const cache = createAnalysisCache({
    enabled: options.cache?.enabled ?? false,
    ttl: options.cache?.ttl,
    maxSize: options.cache?.maxSize,
  });

  // FILE SCAN
  const file_paths = await scan_files(
    options.root_path,
    options.include_patterns,
    options.exclude_patterns
  );

  console.log(`Found ${file_paths.length} files to analyze`);
  if (cache.getStats().enabled) {
    console.log(`Cache enabled with TTL: ${options.cache?.ttl || 900000}ms`);
  }

  // FILE ANALYSIS WITH CACHING
  const analysis_promises = file_paths.map(async (file_path) => {
    const file = await read_and_parse_file(file_path);

    // Check cache first
    const cachedAnalysis = cache.getCachedAnalysis(file_path, file.source_code);
    if (cachedAnalysis) {
      console.debug(`Cache hit for ${file_path}`);
      // Still need to return with tree for compatibility
      const { tree } = await analyze_file(file); // Parse tree only
      return { analysis: cachedAnalysis, tree };
    }

    // Analyze and cache result
    const result = await analyze_file(file);
    cache.cacheAnalysis(file_path, file.source_code, result.analysis);
    return result;
  });

  const analysis_and_trees = await Promise.all(analysis_promises);

  const analyses = analysis_and_trees.map((analysis) => analysis.analysis);
  const file_name_to_tree = new Map(
    analysis_and_trees.map((analysis) => [
      analysis.analysis.file_path,
      analysis.tree,
    ])
  );

  // TYPE REGISTRY - Build unified type registry from all files (needed for enrichment)
  const type_registry = build_type_registry(analyses);

  // CLASS HIERARCHY - Build inheritance tree from all classes (needed for enrichment)
  const class_hierarchy = await build_class_hierarchy_from_analyses(
    analyses,
    file_name_to_tree
  );

  // TODO: LAYER 9 - Global Call Resolution
  // After class hierarchy and type registry are built (Layers 6-7),
  // resolve method and constructor calls using global information:
  // const { resolve_all_calls } = await import('./call_graph/call_resolution');
  // const resolved = resolve_all_calls(
  //   all_method_calls,
  //   all_constructor_calls,
  //   classes,
  //   type_registry
  // );

  // METHOD HIERARCHY ENRICHMENT (task 11.62.5)
  // Enrich method calls with class hierarchy information

  // CONSTRUCTOR TYPE VALIDATION (task 11.62.6)
  // Validate and enrich constructor calls with type registry

  // Create imports map for cross-file resolution
  const imports_by_file = new Map<FilePath, ImportInfo[]>();
  for (const analysis of analyses) {
    // Note: analysis.imports are ImportStatement[], but we need ImportInfo[]
    // This is a type mismatch we need to handle - for now, skip the imports
    // TODO: Fix type conversion between ImportStatement and ImportInfo
    imports_by_file.set(analysis.file_path, []);
  }

  // We'll enrich analyses after building the module graph and resolving types
  let enriched_analyses = analyses;

  // FILE ANALYSIS - Build files map from enriched analyses
  const files = new Map<FilePath, FileAnalysis>();
  const language_stats = new Map<Language, number>();

  for (const analysis of enriched_analyses) {
    files.set(analysis.file_path, analysis);
    const count = language_stats.get(analysis.language) || 0;
    language_stats.set(analysis.language, count + 1);
  }

  // MODULE GRAPH - Build from enriched analyses
  const file_data = new Map(
    enriched_analyses.map((a) => [
      a.file_path,
      {
        file_path: a.file_path,
        language: a.language,
        imports: a.imports,
        exports: a.exports,
      },
    ])
  );

  const modules = build_module_graph(file_data, {
    root_path: options.root_path,
    include_external: false,
  });

  // LAYER 7 - Cross-File Type Resolution (Generic Resolution)
  // Resolve generic types across all analyses using the type registry and class hierarchy
  const resolved_generics = await resolve_generics_across_files(
    enriched_analyses,
    type_registry,
    class_hierarchy,
    modules
  );

  // LAYER 7b - Type Propagation (after generics)
  // Propagate types through assignments, function calls, and control flow
  const propagated_types = await propagate_types_across_files(
    enriched_analyses,
    type_registry,
    resolved_generics,
    modules
  );

  // LAYER 7c - Namespace Resolution (after type propagation)
  // Resolve namespace imports and their members across file boundaries
  const namespace_resolutions = await resolve_namespaces_across_files(
    enriched_analyses,
    modules,
    type_registry,
    propagated_types,
    file_name_to_tree
  );

  // LAYER 7d - CALL ENRICHMENT - Enrich calls with all global context now available
  // Create enrichment context with all global information
  const enrichment_context: EnrichmentContext = {
    type_registry,
    class_hierarchy,
    module_graph: modules,
    resolved_generics,
    propagated_types,
    namespace_resolutions,
  };

  // Enrichment options for comprehensive analysis
  const enrichment_options: EnrichmentOptions = {
    resolve_polymorphic: true,
    track_interfaces: true,
    include_confidence: true,
    resolve_virtual_dispatch: true,
    validate_constructors: true,
    track_inheritance: true,
  };

  // Re-enrich analyses with full global context
  enriched_analyses = analyses.map(
    (analysis) =>
      enrich_all_calls(
        analysis,
        enrichment_context,
        enrichment_options
      ) as FileAnalysis
  );

  // Update the files map with enriched analyses
  for (const analysis of enriched_analyses) {
    files.set(analysis.file_path, analysis);
  }

  // LAYER 8: GLOBAL SYMBOL RESOLUTION - Build global symbol table and resolve references
  const global_symbols = build_symbol_table({
    analyses: enriched_analyses,
    module_graph: modules,
    type_registry,
    resolve_imports: true,
    track_visibility: true,
  });

  // LAYER 9: SYMBOL RESOLUTION - Resolve all references to their definitions
  const resolution_results = resolve_all_symbols(
    enriched_analyses,
    global_symbols
  );

  console.log(
    `Resolved ${resolution_results.resolved_calls.size} function calls`
  );
  console.log(
    `Resolved ${resolution_results.resolved_methods.size} method calls`
  );
  console.log(
    `Resolved ${resolution_results.resolved_constructors.size} constructor calls`
  );
  console.log(`Unresolved references: ${resolution_results.unresolved.length}`);

  // CALL GRAPH - Build from enriched analyses using resolved symbols
  const calls = build_call_graph(enriched_analyses, resolution_results);

  // TYPE INDEX
  const types = build_type_index(enriched_analyses);

  // SYMBOL INDEX - Enhanced with global symbol table
  const symbols = build_symbol_index(enriched_analyses, global_symbols);

  return {
    files,
    modules,
    calls,
    classes: class_hierarchy,
    types,
    symbols,
    metadata: {
      root_path: options.root_path,
      file_count: file_paths.length,
      analysis_time: Date.now() - start_time,
      language_stats,
    },
  };
}

// analyze_file function has been moved to file_analyzer.ts

/**
 * Build call graph from file analyses using resolved symbols
 */
function build_call_graph(
  analyses: FileAnalysis[],
  resolution_results: {
    resolved_calls: Map<Location, SymbolId>;
    resolved_methods: Map<Location, SymbolId>;
    resolved_constructors: Map<Location, SymbolId>;
    resolved_variables: Map<Location, SymbolId>;
    unresolved: Location[];
  }
): CallGraph {
  const functions = new Map<SymbolId, FunctionNode>();
  const edges: CallEdge[] = [];

  // Build function nodes from all functions and methods
  for (const analysis of analyses) {
    // Add function nodes
    for (const func of analysis.functions) {
      const symbol =
        resolution_results.resolved_calls.get(func.location) ||
        construct_function_symbol(analysis.file_path, func.name);

      functions.set(symbol, {
        symbol,
        file_path: analysis.file_path,
        location: func.location,
        signature: func.signature,
        calls: [],
        called_by: [],
        is_exported: false, // TODO: Check exports
        is_entry_point: false,
      });
    }

    // Add method nodes
    for (const cls of analysis.classes) {
      for (const method of cls.methods) {
        const symbol =
          resolution_results.resolved_methods.get(method.location) ||
          construct_method_symbol(
            analysis.file_path,
            cls.name,
            method.name,
            method.is_static
          );

        functions.set(symbol, {
          symbol,
          file_path: analysis.file_path,
          location: method.location,
          signature: {
            parameters: method.parameters,
            return_type: method.return_type,
            type_parameters: method.generics,
            is_async: method.is_async,
          },
          calls: [],
          called_by: [],
          is_exported: false, // TODO: Check if class is exported
          is_entry_point: false,
        });
      }
    }
  }

  // Build call edges using resolved symbols where available
  for (const analysis of analyses) {
    // Function calls
    for (const call of analysis.function_calls) {
      const from = construct_function_symbol(
        analysis.file_path,
        call.caller_name || SPECIAL_SYMBOLS.MODULE
      );

      // Use resolved symbol if available, otherwise use unresolved name
      const to =
        resolution_results.resolved_calls.get(call.location) ||
        construct_function_symbol(analysis.file_path, call.callee_name);

      edges.push({
        from,
        to,
        location: call.location,
        call_type: "direct",
      });
    }

    // Method calls
    for (const call of analysis.method_calls) {
      const from = construct_function_symbol(
        analysis.file_path,
        call.caller_name || SPECIAL_SYMBOLS.MODULE
      );

      // Use resolved symbol if available
      const to =
        resolution_results.resolved_methods.get(call.location) ||
        construct_method_symbol(
          analysis.file_path,
          call.receiver_name,
          call.method_name,
          call.is_static_method
        );

      edges.push({
        from,
        to,
        location: call.location,
        call_type: "method",
      });
    }
  }

  // Build call chains
  const all_calls = [
    ...analyses.flatMap((analysis) => analysis.function_calls),
    ...analyses.flatMap((analysis) => analysis.method_calls),
    ...analyses.flatMap((analysis) => analysis.constructor_calls),
  ];
  const call_chains = build_call_chains(all_calls, {
    language: analyses[0].language, // TODO: improve multi-language support
    track_recursion: true,
  });

  // Find entry points (functions that are not called by anything)
  const called_functions = new Set<SymbolId>();
  for (const edge of edges) {
    called_functions.add(edge.to);
  }

  const entry_points = new Set<SymbolId>();
  for (const [symbol, node] of functions) {
    if (!called_functions.has(symbol)) {
      entry_points.add(symbol);
    }
  }

  return {
    functions,
    edges,
    entry_points,
    call_chains,
  };
}

/**
 * Build type index from file analyses
 */
function build_type_index(analyses: FileAnalysis[]): TypeIndex {
  const variables = new Map<string, VariableType>();
  const functions = new Map<string, FunctionSignature>();
  const definitions = new Map<string, TypeDefinition>();
  const type_graph: TypeGraph = {
    nodes: new Map(),
    edges: [],
  };

  // Build variable types
  for (const analysis of analyses) {
    if (analysis.type_info) {
      for (const [var_name, type_info] of analysis.type_info.entries()) {
        const key = `${analysis.file_path}#${var_name}`;
        const var_scope = analysis.scopes.nodes.get(var_name);
        if (!var_scope) {
          throw new Error(`Variable ${var_name} not found in scope tree`);
        }
        variables.set(key, {
          name: var_name,
          type: type_info.type_name || "unknown",
          scope_kind: var_scope.type,
          location: type_info.location,
        });
      }
    }
  }

  // TODO: Build function signatures, type definitions, and type graph

  return {
    variables,
    functions,
    definitions,
    type_graph,
  };
}

/**
 * Build symbol index from file analyses and global symbol table
 */
function build_symbol_index(
  analyses: FileAnalysis[],
  global_symbols?: GlobalSymbolTable
): SymbolIndex {
  const definitions = new Map<SymbolId, SymbolDefinition>();
  const usages = new Map<SymbolId, Usage[]>();
  const resolution_cache = new Map<SymbolId, ResolvedSymbol>();

  // If we have a global symbol table, use it to build definitions
  if (global_symbols) {
    for (const [symbol_id, def] of global_symbols.symbols) {
      definitions.set(symbol_id, {
        symbol: def.name,
        location: def.location,
        kind: def.kind as any, // Type mismatch - needs mapping
        is_exported: def.is_exported,
        references: [],
      });
    }
  } else {
    // Fallback to old method if no global symbols
    for (const analysis of analyses) {
      const registry = (analysis as any).symbol_registry;
      if (!registry) continue;

      // Add function definitions
      for (const func of analysis.functions) {
        const symbol_id = registry.get(func);
        if (symbol_id) {
          definitions.set(symbol_id, {
            symbol: func.name,
            location: func.location,
            kind: "function",
            is_exported: false, // TODO: Check if exported
            references: [],
          });
        }
      }

      // Add class definitions
      for (const cls of analysis.classes) {
        const symbol_id = registry.get(cls);
        if (symbol_id) {
          definitions.set(symbol_id, {
            symbol: cls.name,
            location: cls.location,
            kind: "class",
            is_exported: false, // TODO: Check if exported
            references: [],
          });
        }
      }
    }
  }

  // Build exports from global symbol table or analyses
  const exports = global_symbols ? global_symbols.exports : new Map();

  return {
    definitions,
    usages,
    exports,
    resolution_cache,
  };
}

/**
 * Track and validate interface implementations for all classes
 *
 * This function ensures that classes properly implement their declared interfaces
 * and tracks the implementation relationships.
 */
function track_interface_implementations(
  class_definitions: ClassDefinition[],
  hierarchy: ClassHierarchy
): void {
  // The ClassNode already tracks interfaces via the interfaces field
  // This is populated from class_def.implements during hierarchy building
  // For now, we just validate that the data is present

  for (const class_def of class_definitions) {
    if (class_def.implements && class_def.implements.length > 0) {
      const classNode = hierarchy.classes.get(class_def.name);
      if (classNode) {
        // Verify interfaces are properly tracked
        if (!classNode.interfaces || classNode.interfaces.length === 0) {
          console.warn(
            `Class ${class_def.name} implements interfaces but they are not tracked in hierarchy`
          );
        }
      }
    }
  }
}

/**
 * Detect and validate method override information
 *
 * This function uses the method_override module to detect override relationships
 * and validate the hierarchy's override data.
 */
function detect_and_validate_method_overrides(
  hierarchy: ClassHierarchy,
  class_definitions: ClassDefinition[]
): MethodOverrideMap {
  // Build a map of class methods for override analysis
  const class_methods = new Map<string, any[]>();

  for (const class_def of class_definitions) {
    if (class_def.methods && class_def.methods.length > 0) {
      // Convert methods to the format expected by analyze_overrides_with_hierarchy
      const methods = class_def.methods.map((method) => ({
        name: method.name,
        file_path: class_def.file_path,
        location: method.location,
        is_override: method.is_override,
        symbol_id: `${class_def.name}.${method.name}`,
      }));
      class_methods.set(class_def.name, methods);
    }
  }

  // Analyze overrides using the hierarchy and methods
  const override_map = analyze_overrides_with_hierarchy(
    hierarchy,
    class_methods
  );

  // Validate that override information is consistent
  for (const [className, classNode] of hierarchy.classes) {
    if (classNode.methods) {
      for (const [methodName, methodNode] of classNode.methods) {
        const methodKey = `${className}.${methodName}`;
        const overrideInfo = override_map.overrides.get(methodKey);

        if (overrideInfo) {
          // Log if there's a discrepancy
          const hasOverride = overrideInfo.overrides !== undefined;
          if (hasOverride !== methodNode.is_override) {
            console.debug(
              `Override mismatch for ${className}.${methodName}: detected=${hasOverride}, tracked=${methodNode.is_override}`
            );
          }

          // The override_map provides additional detail that can be used
          // by enrichment phases and call graph analysis
        }
      }
    }
  }

  return override_map;
}

/**
 * Build class hierarchy from all file analyses
 *
 * Creates an inheritance tree from all class definitions, enabling
 * method resolution and polymorphic call analysis.
 */
async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[],
  file_name_to_tree: Map<FilePath, Parser.Tree>
): Promise<ClassHierarchy> {
  // Convert ClassInfo to ClassDefinition format
  const class_definitions: ClassDefinition[] = [];
  const contexts = new Map<FilePath, ClassHierarchyContext>();

  for (const analysis of analyses) {
    const file_tree = file_name_to_tree.get(analysis.file_path);
    if (!file_tree) {
      throw new Error(
        `Tree and source code not found for file: ${analysis.file_path}`
      );
    }
    // Create context for this file (without AST for now)
    contexts.set(analysis.file_path, {
      tree: file_tree,
      source_code: analysis.source_code,
      file_path: analysis.file_path,
      language: analysis.language,
      all_definitions: [], // Will be populated if needed
    });

    // Classes are already ClassDefinition in FileAnalysis
    for (const classDef of analysis.classes) {
      class_definitions.push(classDef);
    }
  }

  // Build the hierarchy using the updated implementation
  const hierarchy = build_class_hierarchy(class_definitions, contexts);

  // Track and validate interface implementations
  // The hierarchy already contains interface data from ClassDefinitions
  // This ensures the data is properly tracked
  track_interface_implementations(class_definitions, hierarchy);

  // Detect and validate method overrides
  // This provides additional override chain analysis beyond what the hierarchy tracks
  const override_map = detect_and_validate_method_overrides(
    hierarchy,
    class_definitions
  );

  // Store the override map for later use in enrichment
  // Note: The override_map could be stored in metadata or passed to enrichment phases
  // For now, we're validating and logging any discrepancies

  return hierarchy;
}
