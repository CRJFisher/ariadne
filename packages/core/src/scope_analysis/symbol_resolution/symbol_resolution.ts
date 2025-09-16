/**
 * Symbol Resolution - Configuration-driven generic processor
 */

import {
  SymbolId,
  SymbolName,
  Location,
  Language,
  FileAnalysis,
  ScopeTree,
  ScopeNode,
  SymbolKind,
  Definition,
  Import,
  Export,
  NamedImport,
  ReExport,
  NamespaceExport,
  FunctionCall,
  MethodCall,
  ConstructorCall,
  FunctionDefinition,
  MethodDefinition,
  ClassDefinition,
  function_symbol,
  method_symbol,
  class_symbol,
  CallInfo,
  symbol_string,
  symbol_from_string,
  FilePath,
  ModuleGraph,
} from "@ariadnejs/types";
import { SyntaxNode } from "tree-sitter";


import { find_scope_at_location, get_scope_chain } from "../scope_tree";
import { ScopeId } from "@ariadnejs/types/src/scopes";
import {
  get_scope_search_order,
  is_builtin_symbol,
  is_global_symbol,
  requires_bespoke_handling,
} from "./language_configs";
import { resolve_function_call } from "./function_resolution";

/**
 * Module context - Shared constants and configuration
 */
export const MODULE_CONTEXT = {
  MODULE_NAME: "symbol_resolution",
  FEATURE_CATEGORY: "scope_analysis",
  PROCESSING_PHASE: "cross_file",
} as const;


/**
 * File resolution context for symbol resolution
 */
export interface FileResolutionContext {
  scope_tree: ScopeTree;
  imports_by_file: ReadonlyMap<FilePath, readonly Import[]>;
  exports_by_file: ReadonlyMap<FilePath, readonly Export[]>;
  language: Language;
  definitions_by_file: ReadonlyMap<FilePath, {
    functions: ReadonlyMap<SymbolId, FunctionDefinition>;
    classes: ReadonlyMap<SymbolId, ClassDefinition>;
    methods: ReadonlyMap<SymbolId, MethodDefinition>;
  }>;
  module_graph?: ModuleGraph;
}

/**
 * Result of definition lookup
 */
export interface DefinitionResult {
  symbol_id?: SymbolId;
  definition?: Definition;
  location?: Location;
  kind?: SymbolKind;
  file_path?: string;
}

/**
 * Resolution context for symbol lookup
 */
export interface ResolutionContext {
  scope_tree: ScopeTree;
  language: Language;
  file_path: string;
  root_node?: SyntaxNode;
  source_code?: string;
  imports?: ImportInfo[];
  exports?: ExportInfo[];
  module_graph?: any;
}

/**
 * Import information
 */
export interface ImportInfo {
  source: string;
  imported_name?: string;
  local_name: string;
  is_default?: boolean;
  is_namespace?: boolean;
}

/**
 * Export information
 */
export interface ExportInfo {
  exported_name: string;
  local_name?: string;
  is_default?: boolean;
  is_re_export?: boolean;
  source?: string;
}

/**
 * Result of symbol resolution - maps definitions to all their calls
 */
export interface ResolutionResult {
  function_calls: Map<FunctionDefinition, readonly FunctionCall[]>;
  function_call_definitions: Map<FunctionCall, FunctionDefinition>;
  method_calls: Map<MethodDefinition, readonly MethodCall[]>;
  method_call_definitions: Map<MethodCall, MethodDefinition>;
  constructor_calls: Map<ClassDefinition, readonly ConstructorCall[]>;
  constructor_call_definitions: Map<ConstructorCall, ClassDefinition>;
  unresolved_calls: readonly CallInfo[];
}


/**
 * Index of definitions by file and symbol
 */
interface DefinitionIndex {
  readonly by_file: ReadonlyMap<FilePath, {
    readonly functions: ReadonlyMap<SymbolId, FunctionDefinition>;
    readonly classes: ReadonlyMap<SymbolId, ClassDefinition>;
    readonly methods: ReadonlyMap<SymbolId, MethodDefinition>;
  }>;
}

/**
 * Cross-file resolution context
 */
interface CrossFileContext {
  readonly imports_by_file: ReadonlyMap<FilePath, readonly Import[]>;
  readonly exports_by_file: ReadonlyMap<FilePath, readonly Export[]>;
  readonly definitions: DefinitionIndex;
}

/**
 * Accumulated resolution state (mutable during construction)
 */
interface ResolutionState {
  readonly function_calls: Map<FunctionDefinition, FunctionCall[]>;
  readonly function_call_definitions: Map<FunctionCall, FunctionDefinition>;
  readonly method_calls: Map<MethodDefinition, MethodCall[]>;
  readonly method_call_definitions: Map<MethodCall, MethodDefinition>;
  readonly constructor_calls: Map<ClassDefinition, ConstructorCall[]>;
  readonly constructor_call_definitions: Map<ConstructorCall, ClassDefinition>;
  readonly unresolved_calls: CallInfo[];
}

/**
 * Build an index of all definitions organized by file and symbol
 */
function build_definition_index(analyses: readonly FileAnalysis[]): DefinitionIndex {
  const by_file = new Map<FilePath, {
    functions: Map<SymbolId, FunctionDefinition>;
    classes: Map<SymbolId, ClassDefinition>;
    methods: Map<SymbolId, MethodDefinition>;
  }>();

  for (const analysis of analyses) {
    const functions = new Map<SymbolId, FunctionDefinition>();
    const classes = new Map<SymbolId, ClassDefinition>();
    const methods = new Map<SymbolId, MethodDefinition>();

    // Index functions by their symbols
    for (const func of analysis.functions) {
      const symbol = function_symbol(func.name, func.location);
      functions.set(symbol, func);
    }

    // Index classes and their methods by their symbols
    for (const cls of analysis.classes) {
      const classSymbol = class_symbol(cls.name, cls.location);
      classes.set(classSymbol, cls);

      for (const method of cls.methods) {
        const methodSymbol = method_symbol(method.name, cls.name, method.location);
        methods.set(methodSymbol, method);
      }
    }

    by_file.set(analysis.file_path, { functions, classes, methods });
  }

  return { by_file };
}

/**
 * Build cross-file resolution context
 */
function build_cross_file_context(
  analyses: readonly FileAnalysis[]
): CrossFileContext {
  const imports_by_file = new Map<FilePath, readonly Import[]>();
  const exports_by_file = new Map<FilePath, readonly Export[]>();

  for (const analysis of analyses) {
    imports_by_file.set(analysis.file_path, analysis.imports);
    exports_by_file.set(analysis.file_path, analysis.exports);
  }

  const definitions = build_definition_index(analyses);

  return {
    imports_by_file,
    exports_by_file,
    definitions,
  };
}

/**
 * Create initial mutable resolution state
 */
function create_resolution_state(): ResolutionState {
  return {
    function_calls: new Map<FunctionDefinition, FunctionCall[]>(),
    function_call_definitions: new Map<FunctionCall, FunctionDefinition>(),
    method_calls: new Map<MethodDefinition, MethodCall[]>(),
    method_call_definitions: new Map<MethodCall, MethodDefinition>(),
    constructor_calls: new Map<ClassDefinition, ConstructorCall[]>(),
    constructor_call_definitions: new Map<ConstructorCall, ClassDefinition>(),
    unresolved_calls: [],
  };
}

/**
 * Record a resolved function call in both directions
 */
function record_function_resolution(
  state: ResolutionState,
  call: FunctionCall,
  definition: FunctionDefinition
): void {
  // Add to definition->calls mapping
  const calls = state.function_calls.get(definition);
  if (calls) {
    calls.push(call);
  } else {
    state.function_calls.set(definition, [call]);
  }
  // Add to call->definition mapping
  state.function_call_definitions.set(call, definition);
}

/**
 * Record a resolved method call in both directions
 */
function record_method_resolution(
  state: ResolutionState,
  call: MethodCall,
  definition: MethodDefinition
): void {
  // Add to definition->calls mapping
  const calls = state.method_calls.get(definition);
  if (calls) {
    calls.push(call);
  } else {
    state.method_calls.set(definition, [call]);
  }
  // Add to call->definition mapping
  state.method_call_definitions.set(call, definition);
}

/**
 * Record a resolved constructor call in both directions
 */
function record_constructor_resolution(
  state: ResolutionState,
  call: ConstructorCall,
  definition: ClassDefinition
): void {
  // Add to definition->calls mapping
  const calls = state.constructor_calls.get(definition);
  if (calls) {
    calls.push(call);
  } else {
    state.constructor_calls.set(definition, [call]);
  }
  // Add to call->definition mapping
  state.constructor_call_definitions.set(call, definition);
}

/**
 * Resolve all calls in a single file analysis
 */
function resolve_file_calls(
  analysis: FileAnalysis,
  cross_file_context: CrossFileContext,
  state: ResolutionState
): void {
  const language = analysis.language;

  const context: FileResolutionContext = {
    scope_tree: analysis.scopes,
    imports_by_file: cross_file_context.imports_by_file,
    exports_by_file: cross_file_context.exports_by_file,
    language,
    definitions_by_file: cross_file_context.definitions.by_file,
  };

  // Resolve function calls
  for (const call of analysis.function_calls) {
    const resolved = resolve_function_call(call, context);
    if (resolved) {
      record_function_resolution(state, call, resolved);
    } else {
      state.unresolved_calls.push(call);
    }
  }

  // Resolve method calls
  for (const call of analysis.method_calls) {
    const resolved = resolve_method_call(call, context);
    if (resolved) {
      record_method_resolution(state, call, resolved);
    } else {
      state.unresolved_calls.push(call);
    }
  }

  // Resolve constructor calls
  for (const call of analysis.constructor_calls) {
    const resolved = resolve_constructor_call(call, context);
    if (resolved) {
      record_constructor_resolution(state, call, resolved);
    } else {
      state.unresolved_calls.push(call);
    }
  }
}

/**
 * Convert mutable resolution state to immutable result
 */
function finalize_resolution_result(state: ResolutionState): ResolutionResult {
  // Convert mutable arrays to readonly arrays
  const function_calls = new Map<FunctionDefinition, readonly FunctionCall[]>();
  const func_entries = Array.from(state.function_calls.entries());
  for (const [def, calls] of func_entries) {
    function_calls.set(def, calls);
  }

  const method_calls = new Map<MethodDefinition, readonly MethodCall[]>();
  const method_entries = Array.from(state.method_calls.entries());
  for (const [def, calls] of method_entries) {
    method_calls.set(def, calls);
  }

  const constructor_calls = new Map<ClassDefinition, readonly ConstructorCall[]>();
  const constructor_entries = Array.from(state.constructor_calls.entries());
  for (const [def, calls] of constructor_entries) {
    constructor_calls.set(def, calls);
  }

  return {
    function_calls,
    method_calls,
    constructor_calls,
    function_call_definitions: state.function_call_definitions,
    method_call_definitions: state.method_call_definitions,
    constructor_call_definitions: state.constructor_call_definitions,
    unresolved_calls: state.unresolved_calls,
  };
}

/**
 * Resolve all symbols in the provided file analyses using configuration-driven patterns
 */
export function resolve_references_to_symbols(
  analyses: readonly FileAnalysis[],
): ResolutionResult {
  // Build cross-file resolution context (immutable)
  const cross_file_context = build_cross_file_context(analyses);

  // Create mutable state for accumulating resolutions
  const state = create_resolution_state();

  // Process each file's calls
  for (const analysis of analyses) {
    // TODO: refactor this to be immutable - its setting the cross_file_context internal objects...
    resolve_file_calls(analysis, cross_file_context, state);
  }

  // Convert to immutable result
  return finalize_resolution_result(state);
}



/**
 * Resolve a method call to its definition
 */
export function resolve_method_call(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { scope_tree, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(
    scope_tree,
    call.location
  );

  if (!call_scope) return undefined;

  const call_scope_node = scope_tree.nodes.get(call_scope);
  if (!call_scope_node) return undefined;

  // Try generic method resolution first
  const symbol = undefined; // TODO: resolve the symbol

  if (symbol) {
    // Look up the method definition
    const file_path = extract_file_from_symbol(symbol);
    const definitions = definitions_by_file.get(file_path);
    if (definitions) {
      return definitions.methods.get(symbol);
    }
  }

  return undefined;
}

/**
 * Resolve a constructor call to its definition
 */
export function resolve_constructor_call(
  call: ConstructorCall,
  context: FileResolutionContext
): ClassDefinition | undefined {
  const { scope_tree, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope_id = find_scope_at_location(
    scope_tree,
    call.location
  );

  if (!call_scope_id) return undefined;

  // Use generic resolution for constructor (similar to function)
  const class_symbol_id = class_symbol(call.class_name, call.location);
  
  const symbol = undefined; // TODO: resolve the symbol

  if (symbol) {
    // Look up the class definition
    const file_path = extract_file_from_symbol(symbol);
    const definitions = definitions_by_file.get(file_path);
    if (definitions) {
      return definitions.classes.get(symbol);
    }
  }

  return undefined;
}

/**
 * Extract file path from a SymbolId
 */
function extract_file_from_symbol(symbol: SymbolId): FilePath {
  // SymbolIds have format "kind:file:name" or "kind:file:class:name"
  const parts = symbol.split(":");
  return (parts[1] || "") as FilePath;
}

