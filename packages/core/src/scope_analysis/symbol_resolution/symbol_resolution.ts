/**
 * Symbol Resolution - Configuration-driven generic processor
 */

import {
  SymbolId,
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
  to_symbol_name,
  to_symbol_id,
  CallInfo,
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
  imports_by_file: Map<string, readonly Import[]>;
  exports_by_file: Map<string, readonly Export[]>;
  language: Language;
  definitions_by_file: Map<string, {
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
 * Result of symbol resolution - maps calls directly to their definitions
 */
export interface ResolutionResult {
  resolved_functions: Map<FunctionCall, FunctionDefinition>;
  resolved_methods: Map<MethodCall, MethodDefinition>;
  resolved_constructors: Map<ConstructorCall, ClassDefinition>;
  unresolved_calls: CallInfo[];
}


/**
 * Resolve all symbols in the provided file analyses using configuration-driven patterns
 */
export function resolve_references_to_symbols(
  analyses: readonly FileAnalysis[],
  global_symbols: GlobalSymbolTable
): ResolutionResult {
  const resolved_functions = new Map<FunctionCall, FunctionDefinition>();
  const resolved_methods = new Map<MethodCall, MethodDefinition>();
  const resolved_constructors = new Map<ConstructorCall, ClassDefinition>();
  const unresolved_calls: CallInfo[] = [];

  // Build import/export maps for cross-file resolution
  const imports_by_file = new Map<string, readonly Import[]>();
  const exports_by_file = new Map<string, readonly Export[]>();
  const definitions_by_file = new Map<string, {
    functions: Map<SymbolId, FunctionDefinition>;
    classes: Map<SymbolId, ClassDefinition>;
    methods: Map<SymbolId, MethodDefinition>;
  }>();

  // Build lookup maps for definitions
  for (const analysis of analyses) {
    imports_by_file.set(analysis.file_path, analysis.imports);
    exports_by_file.set(analysis.file_path, analysis.exports);

    const functions = new Map<SymbolId, FunctionDefinition>();
    const classes = new Map<SymbolId, ClassDefinition>();
    const methods = new Map<SymbolId, MethodDefinition>();

    // Map functions by their symbols
    for (const func of analysis.functions) {
      const symbol = function_symbol(func.name, func.location);
      functions.set(symbol, func);
    }

    // Map classes and their methods by their symbols
    for (const cls of analysis.classes) {
      const classSymbol = class_symbol(cls.name, cls.location);
      classes.set(classSymbol, cls);

      for (const method of cls.methods) {
        const methodSymbol = method_symbol(method.name, cls.name, method.location);
        methods.set(methodSymbol, method);
      }
    }

    definitions_by_file.set(analysis.file_path, { functions, classes, methods });
  }

  // Process each file
  for (const analysis of analyses) {
    const extended_analysis = analysis as FileAnalysis & {
      symbol_registry?: Map<any, SymbolId>;
      scope_entity_connections?: ScopeEntityConnections;
    };

    const language = analysis.language || "javascript";

    const context: FileResolutionContext = {
      file_analysis: extended_analysis,
      global_symbols,
      imports_by_file,
      exports_by_file,
      language,
      definitions_by_file,
    };

    // Resolve function calls
    for (const call of analysis.function_calls) {
      const resolved = resolve_function_call(call, context);
      if (resolved) {
        resolved_functions.set(call, resolved);
      } else {
        unresolved_calls.push(call);
      }
    }

    // Resolve method calls
    for (const call of analysis.method_calls) {
      const resolved = resolve_method_call(call, context);
      if (resolved) {
        resolved_methods.set(call, resolved);
      } else {
        unresolved_calls.push(call);
      }
    }

    // Resolve constructor calls
    for (const call of analysis.constructor_calls) {
      const resolved = resolve_constructor_call(call, context);
      if (resolved) {
        resolved_constructors.set(call, resolved);
      } else {
        unresolved_calls.push(call);
      }
    }
  }

  return {
    resolved_functions,
    resolved_methods,
    resolved_constructors,
    unresolved_calls,
  };
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

  // Use configuration-driven resolution to get the symbol
  const symbol = resolve_symbol(call.callee, call_scope.id, context);

  if (symbol) {
    // Look up the function definition
    const file_path = extract_file_from_symbol(symbol);
    const definitions = definitions_by_file.get(file_path);
    if (definitions) {
      return definitions.functions.get(symbol);
    }
  }

  // Check if bespoke handling is needed
  if (requires_bespoke_handling("function_calls", language)) {
    return resolve_function_call_bespoke(call, context);
  }

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
  // Extract symbol name for lookup
  const symbol_name =
    typeof symbol === "string" && !symbol.includes(":")
      ? symbol
      : symbol.split(":").pop() || "";
  const { file_analysis, global_symbols, language } = context;

  // Check if it's a special symbol
  if (is_global_symbol(symbol_name, language)) {
    return function_symbol(to_symbol_name(symbol_name), {
      file_path: "global" as any,
      line: 0,
      column: 0,
      end_line: 0,
      end_column: 0,
    });
  }

  if (is_builtin_symbol(symbol_name, language)) {
    return function_symbol(to_symbol_name(symbol_name), {
      file_path: "builtin" as any,
      line: 0,
      column: 0,
      end_line: 0,
      end_column: 0,
    });
  }

  // Get scope search order from configuration
  const search_order = get_scope_search_order(language);

  // Search through scopes based on configuration
  for (const order of search_order) {
    let symbol: SymbolId | undefined;

    switch (order) {
      case "local":
        symbol = resolve_in_local_scope(symbol_name, scope_id, file_analysis);
        break;
      case "parent":
      case "enclosing":
        symbol = resolve_in_parent_scopes(symbol_name, scope_id, file_analysis);
        break;
      case "global":
        symbol = resolve_in_global_scope(
          symbol_name,
          file_analysis,
          global_symbols
        );
        break;
      case "builtin":
        // Already handled above
        break;
    }

    if (symbol) return symbol;
  }

  // Try imports
  const imported_symbol = resolve_from_imports(
    symbol_name,
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
  symbol: SymbolId,
  scope_id: ScopeId,
  file_analysis: FileAnalysis
): SymbolId | undefined {
  const symbol_name =
    typeof symbol === "string" && !symbol.includes(":")
      ? symbol
      : symbol.split(":").pop() || "";
  const scope = file_analysis.scopes.nodes.get(scope_id);
  if (!scope) return undefined;

  // First check if symbol exists in scope's symbol map
  const scope_symbol = scope.symbols.get(symbol_name);
  if (scope_symbol && scope_symbol.kind === "function") {
    return function_symbol(symbol_name, scope_symbol.location);
  }

  // Then check if symbol is defined in this scope via definitions
  for (const def of file_analysis.definitions) {
    if (def.name === symbol_name && is_definition_in_scope(def, scope)) {
      return function_symbol(file_analysis.file_path, symbol_name);
    }
  }

  return undefined;
}

/**
 * Resolve symbol in parent scopes
 */
function resolve_in_parent_scopes(
  symbol_or_name: SymbolId | string,
  scope_id: ScopeId,
  file_analysis: FileAnalysis
): SymbolId | undefined {
  const symbol_name =
    typeof symbol_or_name === "string" && !symbol_or_name.includes(":")
      ? symbol_or_name
      : symbol_or_name.split(":").pop() || "";
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
  symbol_name: string,
  file_analysis: FileAnalysis,
  global_symbols: GlobalSymbolTable
): SymbolId | undefined {
  // Check global symbol table
  const global_symbol = global_symbols.get(
    function_symbol(file_analysis.file_path, symbol_name)
  );

  if (global_symbol) {
    return global_symbol.id;
  }

  return undefined;
}

/**
 * Resolve symbol from imports
 */
function resolve_from_imports(
  symbol_name: string,
  file_path: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const imports = context.imports_by_file.get(file_path);
  if (!imports) return undefined;

  for (const imp of imports) {
    // Check named imports
    if (imp.imported.some((item) => item === symbol_name)) {
      // Resolve to the exported symbol
      const source_exports = context.exports_by_file.get(imp.source);
      if (source_exports) {
        for (const exp of source_exports) {
          if (exp.exported.includes(symbol_name)) {
            return function_symbol(imp.source, symbol_name);
          }
        }
      }
    }

    // Check default import
    if (imp.default === symbol_name) {
      return function_symbol(imp.source, "default");
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
        const file_path = extract_file_from_symbol(object_symbol);
        return method_symbol(
          call.method_name,
          class_name,
          file_path,
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
  call: FunctionCall,
  context: FileResolutionContext
): FunctionDefinition | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Placeholder for bespoke method call resolution
 */
function resolve_method_call_bespoke(
  call: MethodCall,
  context: FileResolutionContext
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
