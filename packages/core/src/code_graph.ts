/**
 * Code Graph Generation
 * 
 * Main entry point for analyzing a codebase and generating a comprehensive code graph.
 */

import { StoredFile } from './storage/storage_interface';
import {
  FunctionCallInfo,
  MODULE_CONTEXT,
  find_function_calls,
} from './call_graph/function_calls';
import {
  MethodCallInfo,
  find_method_calls,
} from './call_graph/method_calls';
import {
  ConstructorCallInfo,
  find_constructor_calls,
} from './call_graph/constructor_calls';
import { ScopeTree, build_scope_tree } from './scope_analysis/scope_tree';
import {
  ImportInfo,
} from './import_export/import_resolution';
import {
  ExportInfo,
  detect_exports,
} from './import_export/export_detection';
import {
  ModuleGraph,
  build_module_graph,
} from './import_export/module_graph';
import {
  TypeInfo,
} from './type_analysis/type_tracking';
import { Language } from '@ariadnejs/types';
import { scan_files, read_file } from './graph/graph_builder/file_scanner';

// ============================================================================
// Core Types from CODEGRAPH_ARCHITECTURE.md
// ============================================================================

/**
 * Location in source code
 */
export interface Location {
  file_path: string;
  line: number;
  column: number;
  end_line?: number;
  end_column?: number;
}

/**
 * File-level analysis result
 */
export interface FileAnalysis {
  path: string;
  language: Language;
  scopes: ScopeTree;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  ast?: any; // Tree-sitter Tree, optional for memory efficiency
}

/**
 * Function/method information
 */
export interface FunctionInfo {
  id: string;
  name: string;
  location: Location;
  type: 'function' | 'method' | 'constructor';
  parent_class?: string;
  signature?: FunctionSignature;
}

/**
 * Class information
 */
export interface ClassInfo {
  id: string;
  name: string;
  location: Location;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements: string[];
  is_abstract: boolean;
}

/**
 * Method information
 */
export interface MethodInfo {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  is_static: boolean;
  is_abstract: boolean;
  signature?: FunctionSignature;
}

/**
 * Property information
 */
export interface PropertyInfo {
  name: string;
  type?: TypeInfo;
  visibility: 'public' | 'private' | 'protected';
  is_static: boolean;
  is_readonly: boolean;
}

/**
 * Function signature
 */
export interface FunctionSignature {
  parameters: ParameterType[];
  return_type?: TypeInfo;
  type_parameters?: TypeParameter[];
  is_async: boolean;
  is_generator: boolean;
}

/**
 * Parameter type
 */
export interface ParameterType {
  name: string;
  type?: TypeInfo;
  is_optional: boolean;
  default_value?: string;
}

/**
 * Type parameter (generics)
 */
export interface TypeParameter {
  name: string;
  constraint?: TypeInfo;
}

// ============================================================================
// Call Graph Types
// ============================================================================

/**
 * Call graph - represents function and method call relationships
 */
export interface CallGraph {
  functions: Map<string, FunctionNode>;
  calls: CallEdge[];
  resolved_calls: Map<string, ResolvedCall[]>;
  call_chains: Map<string, CallChain>;
}

/**
 * Function node in the call graph
 */
export interface FunctionNode {
  id: string;
  name: string;
  file_path: string;
  type: 'function' | 'method' | 'constructor';
  parent_class?: string;
  signature?: FunctionSignature;
}

/**
 * Call edge in the call graph
 */
export interface CallEdge {
  from: string;
  to: string;
  location: Location;
  is_resolved: boolean;
  is_dynamic: boolean;
}

/**
 * Resolved call with additional metadata
 */
export interface ResolvedCall extends CallEdge {
  resolution_type: 'direct' | 'virtual' | 'interface';
  resolved_via?: 'type_analysis' | 'import_resolution';
}

/**
 * Call chain for deep analysis
 */
export interface CallChain {
  from: string;
  to: string;
  path: string[];
  depth: number;
}

// ============================================================================
// Type System Types
// ============================================================================

/**
 * Global type index
 */
export interface TypeIndex {
  variables: Map<string, VariableType>;
  functions: Map<string, FunctionSignature>;
  definitions: Map<string, TypeDefinition>;
  type_graph: TypeGraph;
}

/**
 * Variable type information
 */
export interface VariableType {
  name: string;
  type: TypeInfo;
  scope: string;
  is_mutable: boolean;
}

/**
 * Type definition (class, interface, type alias)
 */
export interface TypeDefinition {
  name: string;
  type: 'class' | 'interface' | 'type_alias' | 'enum';
  location: Location;
  members?: Map<string, TypeInfo>;
}

/**
 * Type relationship graph for inference
 */
export interface TypeGraph {
  nodes: Map<string, TypeInfo>;
  edges: TypeEdge[];
}

/**
 * Type edge relationship
 */
export interface TypeEdge {
  from: string;
  to: string;
  type: 'extends' | 'implements' | 'references' | 'assigns';
}

// ============================================================================
// Symbol Index Types
// ============================================================================

/**
 * Global symbol index
 */
export interface SymbolIndex {
  definitions: Map<string, Definition>;
  usages: Map<string, Usage[]>;
  exports_by_file: Map<string, ExportedSymbol[]>;
  resolution_cache: Map<string, ResolvedSymbol>;
}

/**
 * Symbol definition
 */
export interface Definition {
  symbol: string;
  location: Location;
  type: 'function' | 'class' | 'variable' | 'type' | 'module';
  is_exported: boolean;
}

/**
 * Symbol usage
 */
export interface Usage {
  symbol: string;
  location: Location;
  type: 'call' | 'reference' | 'type_annotation' | 'import';
}

/**
 * Exported symbol
 */
export interface ExportedSymbol {
  name: string;
  original_name?: string;
  is_default: boolean;
  location: Location;
}

/**
 * Resolved symbol
 */
export interface ResolvedSymbol {
  symbol: string;
  definition: Definition;
  file_path: string;
}

// ============================================================================
// Class Hierarchy Types (temporary until proper implementation)
// ============================================================================

/**
 * Class hierarchy representation
 */
export interface ClassHierarchy {
  classes: Map<string, any>;
  inheritance_edges: any[];
}

// ============================================================================
// Main CodeGraph Structure
// ============================================================================

/**
 * A comprehensive graph representation of a codebase
 */
export interface CodeGraph {
  /**
   * File-level analysis results (foundation layer)
   */
  files: Map<string, FileAnalysis>;
  
  /**
   * Module dependency graph
   */
  modules: ModuleGraph;
  
  /**
   * Function/method call relationships
   */
  calls: CallGraph;
  
  /**
   * Class inheritance tree
   */
  classes: ClassHierarchy;
  
  /**
   * Global type information
   */
  types: TypeIndex;
  
  /**
   * Global symbol table
   */
  symbols: SymbolIndex;
  
  /**
   * Metadata about the graph
   */
  metadata: {
    root_path: string;
    file_count: number;
    analysis_time: number;
    language_stats: Map<Language, number>;
  };
}

/**
 * Options for generating a code graph
 */
export interface CodeGraphOptions {
  /**
   * Root directory of the codebase to analyze
   */
  root_path: string;
  
  /**
   * File patterns to include in analysis.
   * Defaults to common source file extensions.
   */
  include_patterns?: string[];
  
  /**
   * File patterns to exclude from analysis.
   * Defaults to common directories to ignore.
   */
  exclude_patterns?: string[];
}

/**
 * Internal file analysis result
 */
interface InternalFileAnalysis {
  file_path: string;
  language: Language;
  scopes: ScopeTree;
  imports: ImportInfo[];
  exports: ExportInfo[];
  function_calls: FunctionCallInfo[];
  method_calls: MethodCallInfo[];
  constructor_calls: ConstructorCallInfo[];
  types: Map<string, TypeInfo>;
  functions: FunctionInfo[];
  classes: ClassInfo[];
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
  
  // FILE SCAN
  const file_paths = await scan_files(
    options.root_path,
    options.include_patterns,
    options.exclude_patterns
  );
  
  console.log(`Found ${file_paths.length} files to analyze`);

  // FILE ANALYSIS
  const analysis_promises = file_paths.map(async (file_path) => {
    const file = await read_file(file_path);
    return analyze_file(file);
  });
  
  const analyses = await Promise.all(analysis_promises);

  // FILE ANALYSIS
  const files = new Map<string, FileAnalysis>();
  const language_stats = new Map<Language, number>();
  
  // Convert internal analyses to FileAnalysis
  for (const analysis of analyses) {
    const file_analysis: FileAnalysis = {
      path: analysis.file_path,
      language: analysis.language,
      scopes: analysis.scopes,
      imports: analysis.imports,
      exports: analysis.exports,
      functions: analysis.functions,
      classes: analysis.classes,
    };
    files.set(analysis.file_path, file_analysis);
    
    // Track language statistics
    const count = language_stats.get(analysis.language) || 0;
    language_stats.set(analysis.language, count + 1);
  }

  // MODULE GRAPH
  const file_data = new Map(
    analyses.map(a => [a.file_path, {
      file_path: a.file_path,
      language: a.language,
      imports: a.imports,
      exports: a.exports,
    }])
  );
  
  const modules = build_module_graph(file_data, {
    root_path: options.root_path,
    include_external: false
  });

  // CALL GRAPH
  const calls = build_call_graph(analyses);

  // CLASS HIERARCHY
  // TODO: Implement proper class hierarchy building
  const classes: ClassHierarchy = {
    classes: new Map(),
    inheritance_edges: [],
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
function resolve_imports(tree: any, metadata: any): ImportInfo[] {
  // TODO: Implement proper import resolution
  return [];
}

/**
 * Temporary stub for track_variable_types until proper implementation
 */
function track_variable_types(tree: any, metadata: any): TypeInfo[] {
  // TODO: Implement proper type tracking
  return [];
}

/**
 * Analyze a single file
 */
async function analyze_file(
  file: StoredFile
): Promise<InternalFileAnalysis> {
  const metadata = {
    language: file.language,
    file_path: file.file_path,
  };

  // SCOPE TREE
  const source_code = file.source_code || '';
  const scopes = build_scope_tree(file.tree!.rootNode, source_code, file.language, file.file_path);

  // IMPORT/EXPORT ANALYSIS
  const imports = resolve_imports(file.tree!, metadata);
  
  // Create ExportDetectionContext for detect_exports
  const exportContext = {
    language: file.language,
    file_path: file.file_path,
    config: {
      get_scope_graph: () => undefined, // We don't have ScopeGraph, using our ScopeTree
      get_source_code: () => source_code,
    }
  };
  const exports = detect_exports(exportContext);

  // TYPE ANALYSIS
  const type_map = new Map<string, TypeInfo>();
  const types = track_variable_types(file.tree!, metadata);
  // TODO: Fix type tracking - TypeInfo doesn't have variable_name
  
  // CALL ANALYSIS
  const functionCallContext = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: file.tree!.rootNode,
  };
  const function_calls = find_function_calls(functionCallContext);
  
  const methodCallContext = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: file.tree!.rootNode,
  };
  const method_calls = find_method_calls(methodCallContext);
  
  const constructorCallContext = {
    source_code,
    file_path: file.file_path,
    language: file.language,
    ast_root: file.tree!.rootNode,
  };
  const constructor_calls = find_constructor_calls(constructorCallContext);

  // FUNCTIONS AND CLASSES
  const functions: FunctionInfo[] = [];
  const classes: ClassInfo[] = [];

  // Extract functions
  for (const [_, scope] of scopes.nodes.entries()) {
    if (scope.type === "function") {
      const function_name = scope.metadata?.name || "<anonymous>";
      const parent_scope = scope.parent_id ? scopes.nodes.get(scope.parent_id) : null;
      const is_method = parent_scope?.type === "class";
      
      functions.push({
        id: `${file.file_path}#${function_name}`,
        name: function_name,
        location: {
          file_path: file.file_path,
          line: scope.range.start.row,
          column: scope.range.start.column,
          end_line: scope.range.end.row,
          end_column: scope.range.end.column,
        },
        type: is_method ? "method" : "function",
        parent_class: is_method ? parent_scope?.metadata?.name : undefined,
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
        if (child_scope.parent_id === scope.id && child_scope.type === "function") {
          class_methods.push({
            name: child_scope.metadata?.name || "<anonymous>",
            visibility: "public", // TODO: Extract actual visibility
            is_static: false, // TODO: Extract actual static status
            is_abstract: false, // TODO: Extract actual abstract status
          });
        }
      }
      
      classes.push({
        id: `${file.file_path}#class:${class_name}`,
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
        implements: [], // TODO: Extract implements
        is_abstract: false, // TODO: Extract actual abstract status
      });
    }
  }

  return {
    file_path: file.file_path,
    language: file.language,
    scopes,
    imports,
    exports,
    function_calls,
    method_calls,
    constructor_calls,
    types: type_map,
    functions,
    classes,
  };
}

/**
 * Build call graph from file analyses
 */
function build_call_graph(analyses: InternalFileAnalysis[]): CallGraph {
  const functions = new Map<string, FunctionNode>();
  const calls: CallEdge[] = [];
  const resolved_calls = new Map<string, ResolvedCall[]>();
  const call_chains = new Map<string, CallChain>();

  // Build function nodes
  for (const analysis of analyses) {
    for (const func of analysis.functions) {
      functions.set(func.id, {
        id: func.id,
        name: func.name,
        file_path: analysis.file_path,
        type: func.type,
        parent_class: func.parent_class,
        signature: func.signature,
      });
    }
  }

  // Build call edges
  for (const analysis of analyses) {
    for (const call of analysis.function_calls) {
      const from = `${analysis.file_path}#${call.caller_name || MODULE_CONTEXT}`;
      const to = `${analysis.file_path}#${call.callee_name}`;
      
      calls.push({
        from,
        to,
        location: {
          file_path: analysis.file_path,
          line: call.line || call.location.row,
          column: call.column || call.location.column,
        },
        is_resolved: true, // TODO: Determine if resolved
        is_dynamic: false, // TODO: Determine if dynamic
      });
    }

    // Add method calls
    for (const call of analysis.method_calls) {
      const from = `${analysis.file_path}#${call.caller_name || MODULE_CONTEXT}`;
      const to = `${analysis.file_path}#${call.method_name}`;
      
      calls.push({
        from,
        to,
        location: {
          file_path: analysis.file_path,
          line: call.location.row,
          column: call.location.column,
        },
        is_resolved: false, // Method calls need resolution
        is_dynamic: true,
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
function build_type_index(analyses: InternalFileAnalysis[]): TypeIndex {
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
function build_symbol_index(analyses: InternalFileAnalysis[]): SymbolIndex {
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