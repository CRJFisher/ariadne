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
import { ImportInfo } from "./import_export/import_resolution";
import { ExportInfo, detect_exports } from "./import_export/export_detection";
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
} from "@ariadnejs/types";
import {
  scan_files,
  read_and_parse_file,
  CodeFile,
} from "./project/file_scanner";

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

  // CLASS HIERARCHY
  // TODO: Wire up the existing class hierarchy builder once it's converted to new types
  // The inheritance_analysis/class_hierarchy module exists and works but uses old Def types
  // const { build_class_hierarchy } = await import('./inheritance/class_hierarchy');
  
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
 * Temporary stub for resolve_imports until proper implementation
 */
function resolve_imports(tree: Parser.Tree, metadata: any): ImportInfo[] {
  // TODO: Implement proper import resolution
  return [];
}

/**
 * Temporary stub for track_variable_types until proper implementation
 */
function track_variable_types(tree: Parser.Tree, metadata: any): TypeInfo[] {
  // TODO: Implement proper type tracking
  return [];
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

  // SCOPE TREE
  const source_code = file.source_code || "";
  const scopes = build_scope_tree(
    tree.rootNode,
    source_code,
    file.language,
    file.file_path
  );

  // IMPORT/EXPORT ANALYSIS
  const imports = resolve_imports(tree, metadata);

  // Create ExportDetectionContext for detect_exports
  const exportContext = {
    language: file.language,
    file_path: file.file_path,
    config: {
      get_scope_graph: () => undefined, // We don't have ScopeGraph, using our ScopeTree
      get_source_code: () => source_code,
    },
  };
  const exports = detect_exports(exportContext);

  // TYPE ANALYSIS
  const type_map = new Map<string, TypeInfo>();
  const types = track_variable_types(tree, metadata);
  // TODO: Fix type tracking - TypeInfo doesn't have variable_name

  // CALL ANALYSIS
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
  const method_calls = find_method_calls(method_call_context);

  const constructor_call_context = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: tree.rootNode,
  };
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
        extends: undefined, // TODO: Extract parent class
        implements: [], // TODO: Extract implements
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
  const functions = new Map<string, FunctionNode>();
  const calls: CallEdge[] = [];
  const resolved_calls = new Map<string, ResolvedCall[]>();
  const call_chains = new Map<string, CallChain>();

  // Build function nodes
  for (const analysis of analyses) {
    for (const func of analysis.functions) {
      const symbol = func.id;
      functions.set(symbol, {
        symbol,
        file_path: analysis.file_path,
        location: func.location,
        signature: func.signature,
        calls: [],
        called_by: [],
        is_exported: false,
        is_entry_point: false,
        class_name: func.parent_class,
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
