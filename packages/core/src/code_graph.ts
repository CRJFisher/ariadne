/**
 * Code Graph Generation
 *
 * Main entry point for analyzing a codebase and generating a comprehensive code graph.
 */

import {
  find_function_calls,
} from "./call_graph/function_calls";
import { MethodCallInfo, find_method_calls } from "./call_graph/method_calls";
import {
  ConstructorCallInfo,
  find_constructor_calls,
  find_constructor_calls_with_types,
  merge_constructor_types,
} from "./call_graph/constructor_calls";
import { 
  ScopeTree, 
  build_scope_tree,
  find_scope_at_position
} from "./scope_analysis/scope_tree";
import { extract_imports } from "./import_export/import_resolution";
import {
  detect_exports,
  extract_exports,
} from "./import_export/export_detection";
import {
  find_class_definitions,
  ClassDefinition,
} from "./inheritance/class_detection";
import {
  process_file_for_types,
  FileTypeTracker,
  TypeTrackingContext,
} from "./type_analysis/type_tracking";
import { create_type_registry, register_class, TypeRegistry } from "./type_analysis/type_registry";
import { build_module_graph } from "./import_export/module_graph";
import { TypeInfo } from "./type_analysis/type_tracking";
import {
  infer_function_return_type,
  ReturnTypeContext,
} from "./type_analysis/return_type_inference";
import {
  convert_imports_to_statements,
  convert_exports_to_statements,
  convert_type_map_to_public,
  create_readonly_array,
  create_empty_variables,
  create_empty_errors,
  create_location_from_range,
} from "./type_analysis/type_adapters";
import { extract_variable_declarations } from "./variable_analysis/variable_extraction";
import {
  create_error_collector,
  ErrorCollector,
} from "./error_collection/analysis_errors";
import {
  create_def_from_scope,
  find_function_node,
  get_enclosing_class_name,
} from "./definition_extraction/def_factory";
import Parser, { SyntaxNode } from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
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
  FunctionInfo,
  ClassInfo,
  MethodInfo,
  PropertyInfo,
  FunctionSignature,
  ParameterType,
  TypeParameter,
  VariableDeclaration,
  AnalysisError,
  // Module types
  ModuleGraph,
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
  Definition,
  Usage,
  ExportedSymbol,
  ResolvedSymbol,
  // Class types
  ClassHierarchy,
  MethodNode,
  SymbolId,
  FilePath,
} from "@ariadnejs/types";
import type { ClassDefinition as SharedClassDefinition, AnyDefinition } from '@ariadnejs/types/definitions';
import { build_class_hierarchy, type ClassHierarchyContext } from './inheritance/class_hierarchy/class_hierarchy';
import { class_info_to_class_definition } from './utils/type_converters';
import {
  scan_files,
  read_and_parse_file,
  CodeFile,
} from "./project/file_scanner";
import { 
  construct_symbol,
  construct_function_symbol,
  construct_class_symbol,
  construct_method_symbol,
  construct_variable_symbol,
  SPECIAL_SYMBOLS
} from "./utils/symbol_construction";
import { 
  build_scope_path,
  build_full_scope_path,
  get_parent_scope_name,
  find_containing_class
} from "./utils/scope_path_builder";
import { enrich_constructor_calls_with_types } from "./call_graph/constructor_calls/constructor_type_resolver";
import { enrich_method_calls_with_hierarchy } from "./call_graph/method_calls/method_hierarchy_resolver";
import { build_call_chains } from "./call_graph/call_chain_analysis/call_chain_analysis";
import { 
  build_symbol_table,
  GlobalSymbolTable
} from "./scope_analysis/symbol_resolution/global_symbol_table";
import {
  build_scope_entity_connections,
  ScopeEntityConnections
} from "./scope_analysis/scope_entity_connections";
import {
  resolve_all_symbols
} from "./scope_analysis/symbol_resolution/symbol_resolution";

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

  // FILE SCAN
  const file_paths = await scan_files(
    options.root_path,
    options.include_patterns,
    options.exclude_patterns
  );

  console.log(`Found ${file_paths.length} files to analyze`);

  // FILE ANALYSIS
  const analysis_promises = file_paths.map(async (file_path) => {
    const file = await read_and_parse_file(file_path);
    return analyze_file(file);
  });

  const analyses = await Promise.all(analysis_promises);

  // TYPE REGISTRY - Build unified type registry from all files (needed for enrichment)
  const type_registry = await build_type_registry_from_analyses(analyses);

  // CLASS HIERARCHY - Build inheritance tree from all classes (needed for enrichment)
  const class_hierarchy = await build_class_hierarchy_from_analyses(analyses, file_name_to_tree);

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

  // CLASS HIERARCHY
  // TODO: Wire up the existing class hierarchy builder once it's converted to new types
  // The inheritance_analysis/class_hierarchy module exists and works but uses old Def types
  // const { build_class_hierarchy } = await import('./inheritance/class_hierarchy');

  // METHOD HIERARCHY ENRICHMENT (task 11.62.5)
  // Enrich method calls with class hierarchy information

  // CONSTRUCTOR TYPE VALIDATION (task 11.62.6)
  // Validate and enrich constructor calls with type registry

  // Create imports map for cross-file resolution
  const imports_by_file = new Map<string, ImportInfo[]>();
  for (const analysis of analyses) {
    // Note: analysis.imports are ImportStatement[], but we need ImportInfo[]
    // This is a type mismatch we need to handle - for now, skip the imports
    // TODO: Fix type conversion between ImportStatement and ImportInfo
    imports_by_file.set(analysis.file_path, []);
  }

  // Convert shared hierarchy to local format for enrichment (temporary during migration)
  // TODO: Update enrich_method_calls_with_hierarchy to use shared types directly
  const local_hierarchy = convert_shared_to_local_hierarchy(class_hierarchy);
  
  // Enrich analyses with method hierarchy and constructor types
  // Create new analysis objects since properties are readonly
  const enriched_analyses = analyses.map((analysis) => {
    const enriched_method_calls = enrich_method_calls_with_hierarchy(
      analysis.method_calls,
      local_hierarchy
    );

    const enriched_constructor_calls = enrich_constructor_calls_with_types(
      analysis.constructor_calls,
      type_registry,
      imports_by_file
    );

    return {
      ...analysis,
      method_calls: enriched_method_calls,
      constructor_calls: enriched_constructor_calls,
    };
  });

  // FILE ANALYSIS - Build files map from enriched analyses
  const files = new Map<string, FileAnalysis>();
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
  
  // LAYER 8: GLOBAL SYMBOL RESOLUTION - Build global symbol table and resolve references
  const global_symbols = build_symbol_table({
    analyses: enriched_analyses as any[], // Type cast needed due to extended FileAnalysis
    module_graph: modules,
    type_registry,
    resolve_imports: true,
    track_visibility: true
  });

  // LAYER 9: SYMBOL RESOLUTION - Resolve all references to their definitions
  const resolution_results = resolve_all_symbols(
    enriched_analyses,
    global_symbols
  );
  
  console.log(`Resolved ${resolution_results.resolved_calls.size} function calls`);
  console.log(`Resolved ${resolution_results.resolved_methods.size} method calls`);
  console.log(`Resolved ${resolution_results.resolved_constructors.size} constructor calls`);
  console.log(`Unresolved references: ${resolution_results.unresolved.length}`);

  // CALL GRAPH - Build from enriched analyses using resolved symbols
  const calls = build_call_graph(
    enriched_analyses,
    resolution_results
  );

  // Use the built class hierarchy instead of empty placeholder
  const classes = class_hierarchy;

  // TYPE INDEX
  const types = build_type_index(enriched_analyses);

  // SYMBOL INDEX - Enhanced with global symbol table
  const symbols = build_symbol_index(enriched_analyses, global_symbols);

  return {
    files,
    modules,
    calls,
    classes,
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

/**
 * Analyze a single file
 */
async function analyze_file(file: CodeFile): Promise<FileAnalysis> {
  const metadata = {
    language: file.language,
    file_path: file.file_path,
  };

  // PARSE FILE
  const parser = new Parser();
  let tree;

  switch (file.language) {
    case "javascript":
      parser.setLanguage(JavaScript as any);
      break;
    case "typescript":
      parser.setLanguage(TypeScript.typescript as any);
      break;
    case "python":
      parser.setLanguage(Python as any);
      break;
    case "rust":
      parser.setLanguage(Rust as any);
      break;
    default:
      throw new Error(`Unsupported language: ${file.language}`);
  }

  tree = parser.parse(file.source_code);

  // LAYER 1: SCOPE ANALYSIS
  const source_code = file.source_code || "";
  const scopes = build_scope_tree(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );

  // LAYER 2: LOCAL STRUCTURE DETECTION
  // Extract imports (needs scope tree)
  const imports = extract_imports(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );

  // Extract exports
  const exports = extract_exports(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );

  // Detect class definitions
  const classDetectionContext = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  const class_definitions = find_class_definitions(classDetectionContext);

  // LAYER 3: LOCAL TYPE ANALYSIS (needs scope tree, imports, classes)
  const typeTrackingContext: TypeTrackingContext = {
    language: file.language,
    file_path: file.file_path,
    debug: false,
  };
  const type_tracker = process_file_for_types(
    source_code,
    tree.rootNode,
    typeTrackingContext,
    scopes, // From Layer 1
    imports, // From Layer 2
    class_definitions // From Layer 2
  );
  const type_map = new Map<string, TypeInfo[]>();

  // LAYER 4: LOCAL CALL ANALYSIS (needs type info from Layer 3)
  const function_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  const function_calls = find_function_calls(function_call_context);

  // CONSTRUCTORS FIRST - Extract types from constructor calls for enrichment
  const constructor_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };

  // BIDIRECTIONAL FLOW (task 11.62.7) - Extract types from constructor calls
  const constructor_result = find_constructor_calls_with_types(
    constructor_call_context
  );
  const constructor_calls = constructor_result.calls;

  // Merge constructor-discovered types into the type map
  const enriched_type_map = merge_constructor_types(
    type_tracker.variable_types,
    constructor_result.type_assignments
  );

  // Replace type_map with enriched data (includes constructor types)
  type_map.clear();
  for (const [variable, types] of enriched_type_map) {
    type_map.set(variable, types);
  }

  // METHODS - Now with enriched type map including constructor types and imports
  const method_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  const method_calls = find_method_calls(
    method_call_context,
    enriched_type_map // FIXED: Now includes imports AND constructor-inferred types!
  );

  // FUNCTIONS AND CLASSES
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];
  
  // Symbol registry to track entity symbols
  const symbol_registry = new Map<any, SymbolId>();

  // Extract functions with return type inference and symbol creation
  for (const [scope_id, scope] of scopes.nodes.entries()) {
    if (scope.type === "function") {
      const function_name = scope.metadata?.name || SPECIAL_SYMBOLS.ANONYMOUS;
      const parent_scope = scope.parent_id
        ? scopes.nodes.get(scope.parent_id)
        : null;
      const is_method = parent_scope?.type === "class";
      
      // Build scope path for symbol creation
      const scope_path = build_scope_path(scope, scopes);
      
      // Create symbol for this function
      let symbol_id: SymbolId;
      if (is_method && parent_scope?.metadata?.name) {
        // Method symbol
        symbol_id = construct_method_symbol(
          file.file_path,
          parent_scope.metadata.name,
          function_name,
          false // TODO: detect static methods
        );
      } else {
        // Regular function symbol
        symbol_id = construct_function_symbol(
          file.file_path,
          function_name,
          scope_path.length > 0 ? scope_path[scope_path.length - 1] : undefined
        );
      }

      // Create Def for return type inference
      const def = create_def_from_scope(scope, file.file_path, scopes);

      // Find the function node in AST (using location instead of range)
      const func_node = find_function_node(tree.rootNode, scope.location);

      // Infer return type if we have the function node
      let return_type: string | undefined;
      if (func_node) {
        const return_context: ReturnTypeContext = {
          language: file.language,
          source_code,
          type_tracker: type_tracker,
          class_name: get_enclosing_class_name(scope, scopes),
        };

        const return_info = infer_function_return_type(
          def,
          func_node,
          return_context
        );

        return_type = return_info?.type_name;
      }

      const function_info: FunctionInfo = {
        name: function_name,
        location: scope.location,
        signature: {
          parameters: [],
          return_type,
          is_async: scope.metadata?.is_async || false,
          is_generator: scope.metadata?.is_generator || false,
        },
      };
      
      functions.push(function_info);
      
      // Store symbol mapping
      symbol_registry.set(function_info, symbol_id);
    }
  }

  // Extract classes with symbol creation
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "class") {
      const class_name = scope.metadata?.name || SPECIAL_SYMBOLS.ANONYMOUS;
      
      // Build scope path for symbol creation
      const scope_path = build_scope_path(scope, scopes);
      
      // Create symbol for this class
      const class_symbol_id = construct_class_symbol(
        file.file_path,
        class_name,
        scope_path.length > 0 ? scope_path[scope_path.length - 1] : undefined
      );

      // Find methods within this class
      const class_methods: MethodInfo[] = [];
      for (const [_, child_scope] of scopes.nodes.entries()) {
        if (
          child_scope.parent_id === scope.id &&
          child_scope.type === "function"
        ) {
          const method_name = child_scope.metadata?.name || SPECIAL_SYMBOLS.ANONYMOUS;
          
          // Create symbol for this method
          const method_symbol_id = construct_method_symbol(
            file.file_path,
            class_name,
            method_name,
            false // TODO: detect static methods
          );
          
          const method_info: MethodInfo = {
            name: method_name,
            location: child_scope.location,
            signature: {
              parameters: [],
              is_async: child_scope.metadata?.is_async || false,
              is_generator: child_scope.metadata?.is_generator || false,
            },
            visibility: "public", // TODO: Extract actual visibility
            is_static: false, // TODO: Extract actual static status
            is_abstract: false, // TODO: Extract actual abstract status
          };
          
          class_methods.push(method_info);
          
          // Store method symbol mapping
          symbol_registry.set(method_info, method_symbol_id);
        }
      }

      const class_info: ClassInfo = {
        name: class_name,
        location: scope.location,
        methods: class_methods,
        properties: [], // TODO: Extract properties
        is_abstract: false, // TODO: Extract actual abstract status
        is_exported: false, // TODO: Extract export status
        base_classes: [], // TODO: Extract base classes
        interfaces: [], // TODO: Extract interfaces
        docstring: undefined, // TODO: Extract docstring
        decorators: [], // TODO: Extract decorators
      };
      
      classes.push(class_info);
      
      // Store class symbol mapping
      symbol_registry.set(class_info, class_symbol_id);
    }
  }

  // Create error collector
  const error_collector = create_error_collector(file.file_path, file.language);

  // Extract variable declarations with symbol creation
  const variables = extract_variable_declarations(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );
  
  // Create symbols for variables
  for (const variable of variables) {
    // Find the scope containing this variable
    const variable_scope = find_scope_at_position(scopes, variable.location);
    
    if (variable_scope) {
      const scope_path = build_full_scope_path(variable_scope, scopes);
      const variable_symbol_id = construct_variable_symbol(
        file.file_path,
        variable.name,
        scope_path
      );
      
      // Store variable symbol mapping
      symbol_registry.set(variable, variable_symbol_id);
    }
  }

  // Convert imports and exports to public API types
  const import_statements = convert_imports_to_statements(
    imports,
    file.file_path
  );
  const export_statements = convert_exports_to_statements(
    exports,
    file.file_path
  );

  // Convert type map to public format
  const public_type_info = convert_type_map_to_public(type_map);

  // Get collected errors
  const analysis_errors = error_collector.get_errors();
  
  // Build scope-entity connections after all entities are created
  const scope_entity_connections = build_scope_entity_connections(
    scopes,
    functions,
    classes,
    variables,
    symbol_registry,
    file.language,
    file.file_path
  );

  // Create extended file analysis with symbol registry and connections
  const file_analysis: FileAnalysis & { 
    symbol_registry: Map<any, SymbolId>;
    scope_entity_connections: ScopeEntityConnections;
  } = {
    file_path: file.file_path,
    language: file.language,
    functions: create_readonly_array(functions),
    classes: create_readonly_array(classes),
    imports: import_statements,
    exports: export_statements,
    variables: create_readonly_array(variables),
    errors: analysis_errors,
    scopes,
    function_calls: create_readonly_array(function_calls),
    method_calls: create_readonly_array(method_calls),
    constructor_calls: create_readonly_array(constructor_calls),
    type_info: public_type_info,
    symbol_registry, // Add symbol registry for later use
    scope_entity_connections, // Add scope-entity connections
  };
  
  return file_analysis;
}

// TODO: Add helper functions for AST navigation when re-integrating return type inference

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
      const symbol = resolution_results.resolved_calls.get(func.location) || 
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
        const symbol = resolution_results.resolved_methods.get(method.location) ||
          construct_method_symbol(analysis.file_path, cls.name, method.name, method.is_static);
        
        functions.set(symbol, {
          symbol,
          file_path: analysis.file_path,
          location: method.location,
          signature: method.signature,
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
      const to = resolution_results.resolved_calls.get(call.location) ||
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
      const to = resolution_results.resolved_methods.get(call.location) ||
        construct_method_symbol(analysis.file_path, call.receiver_name, call.method_name, call.is_static_method);

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
    ...analyses.flatMap(analysis => analysis.function_calls),
    ...analyses.flatMap(analysis => analysis.method_calls),
    ...analyses.flatMap(analysis => analysis.constructor_calls),
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
    for (const [var_name, type_info] of analysis.types.entries()) {
      const key = `${analysis.file_path}#${var_name}`;
      variables.set(key, {
        name: var_name,
        type: type_info,
        scope: analysis.file_path, // TODO: Get actual scope
        is_mutable: true, // TODO: Determine mutability
      });
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
  const definitions = new Map<SymbolId, Definition>();
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
        file_path: def.file_path,
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
            file_path: analysis.file_path,
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
            file_path: analysis.file_path,
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
 * Build type registry from all file analyses
 *
 * Creates a unified type registry combining type information from all files.
 * This enables cross-file type resolution and validation.
 */
async function build_type_registry_from_analyses(
  analyses: FileAnalysis[]
): Promise<TypeRegistry> {

  const registry = create_type_registry();

  // Register all classes from all files
  for (const analysis of analyses) {
    for (const class_def of analysis.classes) {
      register_class(registry, {
        name: class_def.name,
        file_path: analysis.file_path,
        location: class_def.location,
        methods: class_def.methods,
        properties: class_def.properties,
        extends: class_def.base_classes,
        implements: class_def.interfaces,
        is_abstract: class_def.is_abstract,
        is_exported: class_def.is_exported,
        generics: class_def.type_parameters,
        docstring: class_def.docstring,
        decorators: class_def.decorators,
      });
    }

    // TODO: Register interfaces, enums, type aliases, etc.
    // These need to be extracted during per-file analysis first
  }

  return registry;
}

/**
 * Build class hierarchy from all file analyses
 *
 * Creates an inheritance tree from all class definitions, enabling
 * method resolution and polymorphic call analysis.
 */
async function build_class_hierarchy_from_analyses(
  analyses: FileAnalysis[],
  file_name_to_tree: Map<FilePath, SyntaxNode>
): Promise<ClassHierarchy> {

  // Convert ClassInfo to ClassDefinition format
  const class_definitions: SharedClassDefinition[] = [];
  const contexts = new Map<string, ClassHierarchyContext>();
  
  for (const analysis of analyses) {
    // Create context for this file (without AST for now)
    contexts.set(analysis.file_path, {
      tree: file_name_to_tree.get(analysis.file_path), // AST not available in this context
      source_code: '', // Source code not available here
      file_path: analysis.file_path,
      language: analysis.language,
      all_definitions: [] // Will be populated if needed
    });
    
    // Convert each ClassInfo to ClassDefinition
    for (const classInfo of analysis.classes) {
      const classDef = class_info_to_class_definition(
        classInfo,
        analysis.file_path,
        analysis.language
      );
      class_definitions.push(classDef);
    }
  }

  // Build the hierarchy using the updated implementation
  const hierarchy = build_class_hierarchy(class_definitions, contexts);

  return hierarchy;
}

/**
 * Convert shared hierarchy to local format (temporary during migration)
 * @deprecated TODO: Remove once enrichment functions use shared types
 */
function convert_shared_to_local_hierarchy(
  shared: ClassHierarchy
): any {
  // Create a stub local hierarchy that matches the old interface
  const local = {
    classes: new Map(),
    edges: [],
    roots: [],
    language: (shared as any).language || 'unknown'
  };
  
  // Convert classes
  if ((shared as any).classes) {
    for (const [key, node] of (shared as any).classes) {
      local.classes.set(key, {
        definition: {
          name: node.name,
          file_path: node.file_path,
          location: node.location,
        },
        parent_class: node.base_classes?.[0],
        parent_class_def: node.parent_class,
        implemented_interfaces: node.interfaces || [],
        interface_defs: [],
        subclasses: node.derived_classes?.map((name: string) => ({
          name,
          file_path: node.file_path,
          location: node.location
        })) || [],
        all_ancestors: node.all_ancestors || [],
        all_descendants: node.all_descendants || [],
        method_resolution_order: node.method_resolution_order || [],
        methods: node.methods,
        properties: node.properties,
        base_classes: node.base_classes,
        derived_classes: node.derived_classes,
        interfaces: node.interfaces,
        is_abstract: node.is_abstract,
        is_interface: node.is_interface,
        is_trait: node.is_trait
      });
    }
  }
  
  // Convert edges
  if ((shared as any).inheritance_edges) {
    for (const edge of (shared as any).inheritance_edges) {
      local.edges.push({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        source_location: edge.source_location
      });
    }
  }
  
  // Convert roots
  if ((shared as any).root_classes) {
    for (const root of (shared as any).root_classes) {
      local.roots.push({ name: root });
    }
  }
  
  return local;
}
