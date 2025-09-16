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
} from "@ariadnejs/types";
import { SyntaxNode } from "tree-sitter";

import { GlobalSymbolTable } from "./global_symbol_table";
import { ScopeEntityConnections } from "../scope_entity_connections";

import { find_scope_at_location, get_scope_chain } from "../scope_tree";
import { ScopeId } from "@ariadnejs/types/src/scopes";
import {
  get_scope_search_order,
  is_builtin_symbol,
  is_global_symbol,
  requires_bespoke_handling,
} from "./language_configs";

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
  file_analysis: FileAnalysis & {
    symbol_registry?: Map<any, SymbolId>;
    scope_entity_connections?: ScopeEntityConnections;
  };
  global_symbols: GlobalSymbolTable;
  imports_by_file: Map<FilePath, readonly Import[]>;
  exports_by_file: Map<FilePath, readonly Export[]>;
  language: Language;
  definitions_by_file: Map<FilePath, {
    functions: Map<SymbolId, FunctionDefinition>;
    classes: Map<SymbolId, ClassDefinition>;
    methods: Map<SymbolId, MethodDefinition>;
  }>;
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
  readonly imports_by_file: ReadonlyMap<string, readonly Import[]>;
  readonly exports_by_file: ReadonlyMap<string, readonly Export[]>;
  readonly definitions: DefinitionIndex;
  readonly global_symbols: GlobalSymbolTable;
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
  analyses: readonly FileAnalysis[],
  global_symbols: GlobalSymbolTable
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
    global_symbols,
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
  const extended_analysis = analysis as FileAnalysis & {
    symbol_registry?: Map<any, SymbolId>;
    scope_entity_connections?: ScopeEntityConnections;
  };

  const language = analysis.language || "javascript";

  const context: FileResolutionContext = {
    file_analysis: extended_analysis,
    global_symbols: cross_file_context.global_symbols,
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
  for (const [def, calls] of state.function_calls) {
    function_calls.set(def, calls);
  }

  const method_calls = new Map<MethodDefinition, readonly MethodCall[]>();
  for (const [def, calls] of state.method_calls) {
    method_calls.set(def, calls);
  }

  const constructor_calls = new Map<ClassDefinition, readonly ConstructorCall[]>();
  for (const [def, calls] of state.constructor_calls) {
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
  global_symbols: GlobalSymbolTable
): ResolutionResult {
  // Build cross-file resolution context (immutable)
  const cross_file_context = build_cross_file_context(analyses, global_symbols);

  // Create mutable state for accumulating resolutions
  const state = create_resolution_state();

  // Process each file's calls
  for (const analysis of analyses) {
    resolve_file_calls(analysis, cross_file_context, state);
  }

  // Convert to immutable result
  return finalize_resolution_result(state);
}

/**
 * Resolve a function call to its definition using configuration-driven patterns
 */
export function resolve_function_call(
  call: FunctionCall,
  context: FileResolutionContext
): FunctionDefinition | undefined {
  const { file_analysis, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // TODO: see if it resolves via imports / global symbols. Need to match symbol-name (at point of call) 

  // Use configuration-driven resolution to get the symbol
  // const symbol = resolve_symbol(call.callee, call_scope, context);
  const symbol = call.callee;
  const file_path = extract_file_from_symbol(symbol);
  const definitions = definitions_by_file.get(file_path);
  if (definitions) {
    return definitions.functions.get(symbol);
  }
  // TODO: resort to search
  return undefined;
}

/**
 * Resolve a method call to its definition
 */
export function resolve_method_call(
  call: MethodCall,
  context: FileResolutionContext
): MethodDefinition | undefined {
  const { file_analysis, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_location(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // Try generic method resolution first
  const symbol = resolve_method_generic(call, call_scope, context);

  if (symbol) {
    // Look up the method definition
    const file_path = extract_file_from_symbol(symbol);
    const definitions = definitions_by_file.get(file_path);
    if (definitions) {
      return definitions.methods.get(symbol);
    }
  }

  // Check if bespoke handling is needed
  if (requires_bespoke_handling("method_calls", language)) {
    return resolve_method_call_bespoke(call, context);
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
  const { file_analysis, language, definitions_by_file } = context;

  // Find the scope where this call is made
  const call_scope_id = find_scope_at_location(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope_id) return undefined;

  // Use generic resolution for constructor (similar to function)
  const class_symbol_id = class_symbol(call.class_name, call.location);
  const symbol = resolve_symbol(class_symbol_id, call_scope_id, context);

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

function resolve_symbol(
  symbol: SymbolId,
  scope_id: ScopeId,
  context: FileResolutionContext
): SymbolId | undefined {
  // TODO: why are we resolving a symbol if we already have the symbol??

  // Extract symbol name for lookup
  const symbol_def = symbol_from_string(symbol);
  const { file_analysis, global_symbols, language } = context;

  // Check if it's a special symbol
  if (is_global_symbol(symbol_def.name, language)) {
    return symbol_string({
      kind: "global",
      name: symbol_def.name,
      location: symbol_def.location,
    });
  }

  if (is_builtin_symbol(symbol_def.name, language)) {
    return symbol_string({
      kind: "function",
      name: symbol_def.name,
      location: {
        file_path: "builtin" as any,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0,
      }
    });
  }

  // Get scope search order from configuration
  const search_order = get_scope_search_order(language);

  // Search through scopes based on configuration
  for (const order of search_order) {
    let resolved: SymbolId | undefined;

    switch (order) {
      case "local":
        resolved = resolve_in_local_scope(symbol_def.name, scope_id, file_analysis);
        break;
      case "parent":
      case "enclosing":
        resolved = resolve_in_parent_scopes(symbol_def.name, scope_id, file_analysis);
        break;
      case "global":
        resolved = resolve_in_global_scope(
          symbol_def.name,
          file_analysis,
          global_symbols
        );
        break;
      case "builtin":
        // Already handled above
        break;
    }

    if (resolved) return resolved;
  }

  // Try imports
  const imported_symbol = resolve_from_imports(
    symbol_def.name,
    file_analysis.file_path,
    context
  );
  if (imported_symbol) return imported_symbol;

  return undefined;
}

/**
 * Resolve symbol in local scope
 */
function resolve_in_local_scope(
  symbol_name: SymbolName,
  scope_id: ScopeId,
  file_analysis: FileAnalysis
): SymbolId | undefined {
  const scope = file_analysis.scopes.nodes.get(scope_id);
  if (!scope) return undefined;

  // Check if symbol is defined in this scope
  // Look through functions in this file
  for (const func of file_analysis.functions) {
    if (func.name === symbol_name) {
      // Check if this function is in the current scope
      const func_scope = find_scope_at_location(file_analysis.scopes, func.location);
      if (func_scope && func_scope.id === scope_id) {
        return function_symbol(symbol_name, func.location);
      }
    }
  }

  return undefined;
}

/**
 * Resolve symbol in parent scopes
 */
function resolve_in_parent_scopes(
  symbol_name: SymbolName,
  scope_id: ScopeId,
  file_analysis: FileAnalysis
): SymbolId | undefined {
  const scope_chain = get_scope_chain(scope_id, file_analysis.scopes);

  // Skip the current scope (already checked)
  for (let i = 1; i < scope_chain.length; i++) {
    const parent_scope = scope_chain[i];

    // Look for symbol in parent scope
    const symbol = resolve_in_local_scope(
      symbol_name,
      parent_scope.id,
      file_analysis
    );
    if (symbol) return symbol;
  }

  return undefined;
}

/**
 * Resolve symbol in global scope
 */
function resolve_in_global_scope(
  symbol_name: SymbolName,
  file_analysis: FileAnalysis,
  global_symbols: GlobalSymbolTable
): SymbolId | undefined {
  // Check global symbol table
  // GlobalSymbolTable is a Map<SymbolId, GlobalSymbol>
  // We need to search through it to find the symbol with matching name
  for (const [symbol_id, global_symbol] of global_symbols) {
    const symbol_def = symbol_from_string(symbol_id);
    if (symbol_def.name === symbol_name) {
      return symbol_id;
    }
  }

  return undefined;
}

/**
 * Resolve symbol from imports
 */
function resolve_from_imports(
  symbol_name: SymbolName,
  file_path: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const imports = context.imports_by_file.get(file_path);
  if (!imports) return undefined;

  for (const imp of imports) {
    // Check if this is a named import
    if (imp.kind === "named") {
      for (const imported_item of imp.imports) {
        const local_name = imported_item.alias || imported_item.name;
        if (local_name === symbol_name) {
          // Resolve to the exported symbol from the source module
          return function_symbol(imported_item.name, {
            file_path: imp.source as FilePath,
            line: 0,
            column: 0,
            end_line: 0,
            end_column: 0,
          });
        }
      }
    }

    // Check if this is a default import
    if (imp.kind === "default" && imp.name === symbol_name) {
      return function_symbol("default" as SymbolName, {
        file_path: imp.source as FilePath,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0,
      });
    }
  }

  return undefined;
}

/**
 * Generic method resolution
 */
function resolve_method_generic(
  call: MethodCall,
  scope: ScopeNode,
  context: FileResolutionContext
): SymbolId | undefined {
  // For generic method resolution, try to find the object type
  // and then look for the method on that type

  if (call.receiver) {
    // Find the object's type
    const object_symbol = resolve_symbol(call.receiver, scope.id, context);

    if (object_symbol) {
      // Extract class name from the resolved symbol to build method symbol
      const class_name = extract_class_from_symbol(object_symbol);
      if (class_name) {
        return method_symbol(
          call.method_name,
          class_name,
          call.location
        );
      }
    }
  }

  return undefined;
}

/**
 * Placeholder for bespoke function call resolution
 */
function resolve_function_call_bespoke(
  _call: FunctionCall,
  _context: FileResolutionContext
): FunctionDefinition | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Placeholder for bespoke method call resolution
 */
function resolve_method_call_bespoke(
  _call: MethodCall,
  _context: FileResolutionContext
): MethodDefinition | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Extract file path from a SymbolId
 */
function extract_file_from_symbol(symbol: SymbolId): string {
  // SymbolIds have format "kind:file:name" or "kind:file:class:name"
  const parts = symbol.split(":");
  return parts[1] || "";
}

/**
 * Extract class name from a SymbolId (for method symbols)
 */
function extract_class_from_symbol(symbol: SymbolId): string | undefined {
  // Class symbols have format "class:file:name"
  const parts = symbol.split(":");
  if (parts[0] === "class") {
    return parts[2];
  }
  return undefined;
}
