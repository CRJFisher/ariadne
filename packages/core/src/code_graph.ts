/**
 * Code Graph Generation
 *
 * Main entry point for analyzing a codebase and generating a comprehensive code graph.
 */

import {
  FunctionCallInfo,
  MODULE_CONTEXT,
  find_function_calls,
} from "./call_graph/function_calls";
import { MethodCallInfo, find_method_calls } from "./call_graph/method_calls";
import {
  ConstructorCallInfo,
  find_constructor_calls,
} from "./call_graph/constructor_calls";
import { ScopeTree, build_scope_tree } from "./scope_analysis/scope_tree";
import { ImportInfo, extract_imports } from "./import_export/import_resolution";
import { ExportInfo, detect_exports } from "./import_export/export_detection";
import { extract_exports } from "./scope_analysis/symbol_resolution";
import { find_class_definitions, ClassDefinition } from "./inheritance/class_detection";
import { process_file_for_types, FileTypeTracker, TypeTrackingContext } from "./type_analysis/type_tracking";
import { register_class, TypeRegistry } from "./type_analysis/type_registry";
import { build_module_graph } from "./import_export/module_graph";
import { TypeInfo } from "./type_analysis/type_tracking";
import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import {
  Language,
  // Main types
  CodeGraph,
  CodeGraphOptions,
  FileAnalysis,
  ImportStatement,
  ExportStatement,
  // Common types
  Location,
  FunctionInfo,
  ClassInfo,
  MethodInfo,
  PropertyInfo,
  FunctionSignature,
  ParameterType,
  TypeParameter,
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
} from "@ariadnejs/types";
import {
  scan_files,
  read_and_parse_file,
  CodeFile,
} from "./project/file_scanner";
import { construct_symbol } from "./utils/symbol_construction";

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

  // FILE ANALYSIS
  const files = new Map<string, FileAnalysis>();
  const language_stats = new Map<Language, number>();

  // Convert internal analyses to FileAnalysis
  for (const analysis of analyses) {
    files.set(analysis.file_path, analysis);

    // Track language statistics
    const count = language_stats.get(analysis.language) || 0;
    language_stats.set(analysis.language, count + 1);
  }

  // MODULE GRAPH
  const file_data = new Map(
    analyses.map((a) => [
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

  // CALL GRAPH
  const calls = build_call_graph(analyses);
  
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
  
  // TODO: METHOD HIERARCHY ENRICHMENT (task 11.62.5)
  // After class hierarchy is built, enrich method calls with inheritance information:
  // const { enrich_method_calls_with_hierarchy } = await import('./call_graph/method_calls');
  // for (const [file_path, analysis] of files) {
  //   analysis.method_calls = enrich_method_calls_with_hierarchy(
  //     analysis.method_calls,
  //     classes
  //   );
  // }
  
  // TODO: CONSTRUCTOR TYPE VALIDATION (task 11.62.6)
  // After type registry is built, validate constructor calls:
  // const { enrich_constructor_calls_with_types } = await import('./call_graph/constructor_calls');
  // const type_registry = build_type_registry(analyses); // Need to implement
  // for (const [file_path, analysis] of files) {
  //   analysis.constructor_calls = enrich_constructor_calls_with_types(
  //     analysis.constructor_calls,
  //     type_registry,
  //     imports_by_file
  //   );
  // }
  // Note: Works together with BIDIRECTIONAL FLOW (task 11.62.7) - constructor types
  // discovered during per-file phase can be validated here in global phase
  
  const classes: ClassHierarchy = {
    classes: new Map(),
    inheritance_edges: [],
    root_classes: new Set(),
  };

  // TYPE INDEX
  const types = build_type_index(analyses);

  // SYMBOL INDEX
  const symbols = build_symbol_index(analyses);

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
    case 'javascript':
      parser.setLanguage(JavaScript as any);
      break;
    case 'typescript':
      parser.setLanguage(TypeScript.typescript as any);
      break;
    case 'python':
      parser.setLanguage(Python as any);
      break;
    case 'rust':
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
    debug: false
  };
  const type_tracker = process_file_for_types(
    source_code,
    tree.rootNode,
    typeTrackingContext,
    scopes,      // From Layer 1
    imports,     // From Layer 2
    class_definitions // From Layer 2
  );
  const type_map = new Map<string, TypeInfo>();

  // LAYER 4: LOCAL CALL ANALYSIS (needs type info from Layer 3)
  const function_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  const function_calls = find_function_calls(function_call_context);

  const method_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  const method_calls = find_method_calls(
    method_call_context,
    type_tracker.variable_types  // From Layer 3 (local types only)
  );

  const constructor_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
  
  // TODO: BIDIRECTIONAL FLOW (task 11.62.7)
  // Option to use find_constructor_calls_with_types() instead for bidirectional flow:
  // const { find_constructor_calls_with_types } = await import('./call_graph/constructor_calls');
  // const result = find_constructor_calls_with_types(constructor_call_context);
  // const constructor_calls = result.calls;
  // const constructor_types = result.type_assignments;
  // Then merge constructor_types into type_map using merge_constructor_types()
  
  const constructor_calls = find_constructor_calls(constructor_call_context);

  // FUNCTIONS AND CLASSES
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];

  // Extract functions
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "function") {
      const function_name = scope.metadata?.name || "<anonymous>";
      const parent_scope = scope.parent_id
        ? scopes.nodes.get(scope.parent_id)
        : null;
      const is_method = parent_scope?.type === "class";

      functions.push({
        name: function_name,
        location: {
          file_path: file.file_path,
          line: scope.range.start.row,
          column: scope.range.start.column,
          end_line: scope.range.end.row,
          end_column: scope.range.end.column,
        },
        signature: {
          parameters: [],
          is_async: false,
          is_generator: false,
        },
      });
    }
  }

  // Extract classes
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "class") {
      const class_name = scope.metadata?.name || "<anonymous>";

      // Find methods within this class
      const class_methods: MethodInfo[] = [];
      for (const [_, child_scope] of scopes.nodes.entries()) {
        if (
          child_scope.parent_id === scope.id &&
          child_scope.type === "function"
        ) {
          class_methods.push({
            name: child_scope.metadata?.name || "<anonymous>",
            location: {
              line: child_scope.range.start.row,
              column: child_scope.range.start.column,
              end_line: child_scope.range.end.row,
              end_column: child_scope.range.end.column,
            },
            signature: {
              parameters: [],
              is_async: false,
              is_generator: false,
            },
            visibility: "public", // TODO: Extract actual visibility
            is_static: false, // TODO: Extract actual static status
            is_abstract: false, // TODO: Extract actual abstract status
          });
        }
      }

      classes.push({
        name: class_name,
        location: {
          file_path: file.file_path,
          line: scope.range.start.row,
          column: scope.range.start.column,
          end_line: scope.range.end.row,
          end_column: scope.range.end.column,
        },
        methods: class_methods,
        properties: [], // TODO: Extract properties
        is_abstract: false, // TODO: Extract actual abstract status
        is_exported: false, // TODO: Extract export status
        base_classes: [], // TODO: Extract base classes
        interfaces: [], // TODO: Extract interfaces
        docstring: undefined, // TODO: Extract docstring
        decorators: [], // TODO: Extract decorators
      });
    }
  }

  return {
    file_path: file.file_path,
    language: file.language,
    functions,
    classes,
    imports: [], // TODO: Convert ImportInfo[] to ImportStatement[]
    exports: [], // TODO: Convert ExportInfo[] to ExportStatement[]
    variables: [], // TODO: Extract variable declarations
    errors: [], // TODO: Collect any analysis errors
    scopes,
    function_calls,
    method_calls,
    constructor_calls,
    type_info: type_map,
  };
}

/**
 * Build call graph from file analyses
 */
function build_call_graph(analyses: FileAnalysis[]): CallGraph {
  const functions = new Map<SymbolId, FunctionNode>();
  const calls: CallEdge[] = [];
  const resolved_calls = new Map<string, ResolvedCall[]>();
  const call_chains = new Map<string, CallChain>();

  // Build function nodes
  for (const analysis of analyses) {
    for (const func of analysis.functions) {
      const scope_path = analysis.scopes.nodes.get(func.location.file_path)?.metadata?.name;
      const symbol = construct_symbol({
        file_path: analysis.file_path,
        name: func.name,
        scope_path: [],
        is_anonymous: false,
        location: func.location,
      });
      functions.set(symbol, {
        symbol,
        file_path: analysis.file_path,
        location: func.location,
        signature: func.signature,
        calls: [],
        called_by: [],
        is_exported: false,
        is_entry_point: false,
      });
    }
  }

  // Build call edges
  for (const analysis of analyses) {
    for (const call of analysis.function_calls) {
      const from = `${analysis.file_path}#${
        call.caller_name || MODULE_CONTEXT
      }`;
      const to = `${analysis.file_path}#${call.callee_name}`;

      calls.push({
        from,
        to,
        location: {
          file_path: analysis.file_path,
          line: call.line || call.location.row,
          column: call.column || call.location.column,
        },
        call_type: 'direct', // TODO: Determine if dynamic
      });
    }

    // Add method calls
    for (const call of analysis.method_calls) {
      const from = `${analysis.file_path}#${
        call.caller_name || MODULE_CONTEXT
      }`;
      const to = `${analysis.file_path}#${call.method_name}`;

      calls.push({
        from,
        to,
        location: {
          file_path: analysis.file_path,
          line: call.location.row,
          column: call.location.column,
        },
        call_type: 'method',
      });
    }
  }

  return {
    functions,
    calls,
    resolved_calls,
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
 * Build symbol index from file analyses
 */
function build_symbol_index(analyses: FileAnalysis[]): SymbolIndex {
  const definitions = new Map<string, Definition>();
  const usages = new Map<string, Usage[]>();
  const exports_by_file = new Map<string, ExportedSymbol[]>();
  const resolution_cache = new Map<string, ResolvedSymbol>();

  // Build definitions from functions and classes
  for (const analysis of analyses) {
    // Add function definitions
    for (const func of analysis.functions) {
      definitions.set(func.id, {
        symbol: func.name,
        location: func.location,
        type: "function",
        is_exported: false, // TODO: Check if exported
      });
    }

    // Add class definitions
    for (const cls of analysis.classes) {
      definitions.set(cls.id, {
        symbol: cls.name,
        location: cls.location,
        type: "class",
        is_exported: false, // TODO: Check if exported
      });
    }

    // Build exports by file
    const file_exports: ExportedSymbol[] = [];
    for (const exp of analysis.exports) {
      file_exports.push({
        name: exp.export_name,
        original_name: exp.name, // Use the local name as original
        is_default: exp.is_default,
        location: {
          file_path: analysis.file_path,
          line: exp.range.start.row,
          column: exp.range.start.column,
        },
      });
    }
    exports_by_file.set(analysis.file_path, file_exports);
  }

  return {
    definitions,
    usages,
    exports_by_file,
    resolution_cache,
  };
}
