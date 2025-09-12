/**
 * Symbol Resolution - Configuration-driven generic processor
 *
 * This module provides the core symbol resolution logic that works
 * across all languages using configuration-driven patterns.
 * Language-specific features are handled by bespoke modules.
 */

import {
  SymbolId,
  ScopeId,
  Location,
  Language,
  FileAnalysis,
  ScopeTree,
  ScopeNode,
  SymbolKind,
  FunctionDefinition,
  ClassDefinition,
  SymbolIndex,
  SymbolDefinition,
  Usage,
  Definition,
  Import,
  Export,
  FunctionCall,
} from "@ariadnejs/types";
import { SyntaxNode } from 'tree-sitter';

import { GlobalSymbolTable } from "./global_symbol_table";
import {
  ScopeEntityConnections,
  is_entity_visible_from_scope,
} from "../scope_entity_connections";
import {
  find_scope_at_position,
  get_scope_chain,
  get_visible_symbols,
} from "../scope_tree";
import {
  construct_symbol,
  construct_function_symbol,
  construct_method_symbol,
  construct_class_symbol,
} from "../../utils/symbol_construction";

import {
  get_symbol_resolution_config,
  is_global_symbol,
  is_builtin_symbol,
  is_function_hoisted,
  get_scope_search_order,
  requires_bespoke_handling,
  get_bespoke_handler,
  SymbolResolutionConfig,
} from './language_configs';

/**
 * Module context - Shared constants and configuration
 */
export const MODULE_CONTEXT = {
  MODULE_NAME: 'symbol_resolution',
  FEATURE_CATEGORY: 'scope_analysis',
  PROCESSING_PHASE: 'cross_file',
} as const;

/**
 * Resolved reference information
 */
export interface ResolvedReference {
  symbol_id: SymbolId;
  definition_location: Location;
  kind: SymbolKind;
}

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
  config: SymbolResolutionConfig;
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
  config: SymbolResolutionConfig;
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

export interface ResolutionResult {
  resolved_calls: Map<Location, ResolvedReference>;
  resolved_methods: Map<Location, ResolvedReference>;
  resolved_constructors: Map<Location, ResolvedReference>;
  resolved_variables: Map<Location, ResolvedReference>;
  unresolved: Location[];
}

/**
 * Resolve all symbols in the provided file analyses using configuration-driven patterns
 */
export function resolve_all_symbols(
  analyses: readonly FileAnalysis[],
  global_symbols: GlobalSymbolTable
): ResolutionResult {
  const resolved_calls = new Map<Location, ResolvedReference>();
  const resolved_methods = new Map<Location, ResolvedReference>();
  const resolved_constructors = new Map<Location, ResolvedReference>();
  const resolved_variables = new Map<Location, ResolvedReference>();
  const unresolved: Location[] = [];

  // Build import/export maps for cross-file resolution
  const imports_by_file = new Map<string, readonly Import[]>();
  const exports_by_file = new Map<string, readonly Export[]>();

  for (const analysis of analyses) {
    imports_by_file.set(analysis.file_path, analysis.imports);
    exports_by_file.set(analysis.file_path, analysis.exports);
  }

  // Process each file
  for (const analysis of analyses) {
    const extended_analysis = analysis as FileAnalysis & {
      symbol_registry?: Map<any, SymbolId>;
      scope_entity_connections?: ScopeEntityConnections;
    };

    const language = analysis.language || 'javascript';
    const config = get_symbol_resolution_config(language);

    const context: FileResolutionContext = {
      file_analysis: extended_analysis,
      global_symbols,
      imports_by_file,
      exports_by_file,
      language,
      config,
    };

    // Resolve function calls
    for (const call of analysis.function_calls) {
      const resolved = resolve_function_call(call, context);
      if (resolved) {
        resolved_calls.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }

    // Resolve method calls
    for (const call of analysis.method_calls) {
      const resolved = resolve_method_call(call, context);
      if (resolved) {
        resolved_methods.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }

    // Resolve constructor calls
    for (const call of analysis.constructor_calls) {
      const resolved = resolve_constructor_call(call, context);
      if (resolved) {
        resolved_constructors.set(call.location, resolved);
      } else {
        unresolved.push(call.location);
      }
    }
  }

  return {
    resolved_calls,
    resolved_methods,
    resolved_constructors,
    resolved_variables,
    unresolved,
  };
}

/**
 * Resolve a function call to its definition using configuration-driven patterns
 */
export function resolve_function_call(
  call: FunctionCall,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, global_symbols, config, language } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_position(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // Use configuration-driven resolution
  const symbol = resolve_symbol_generic(
    call.callee_name,
    call_scope.id,
    context
  );

  // Check if bespoke handling is needed
  if (!symbol && requires_bespoke_handling('function_calls', language)) {
    return resolve_function_call_bespoke(call, context);
  }

  return symbol;
}

/**
 * Resolve a method call to its definition
 */
export function resolve_method_call(
  call: MethodCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, language } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_position(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // Try generic method resolution first
  const symbol = resolve_method_generic(call, call_scope, context);

  // Check if bespoke handling is needed
  if (!symbol && requires_bespoke_handling('method_calls', language)) {
    return resolve_method_call_bespoke(call, context);
  }

  return symbol;
}

/**
 * Resolve a constructor call to its definition
 */
export function resolve_constructor_call(
  call: ConstructorCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis, language } = context;

  // Find the scope where this call is made
  const call_scope = find_scope_at_position(
    file_analysis.scopes,
    call.location
  );

  if (!call_scope) return undefined;

  // Use generic resolution for constructor (similar to function)
  const symbol = resolve_symbol_generic(
    call.class_name,
    call_scope.id,
    context
  );

  // Check if bespoke handling is needed
  if (!symbol && requires_bespoke_handling('constructor_calls', language)) {
    return resolve_constructor_call_bespoke(call, context);
  }

  return symbol;
}

/**
 * Generic symbol resolution using configuration
 */
function resolve_symbol_generic(
  symbol: SymbolId,
  scope_id: string,
  context: FileResolutionContext
): SymbolId | undefined;

// Legacy overload for migration compatibility
function resolve_symbol_generic(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): SymbolId | undefined;

function resolve_symbol_generic(
  symbol_or_name: SymbolId | string,
  scope_id: string,
  context: FileResolutionContext
): SymbolId | undefined {
  // Extract symbol name for lookup
  const symbol_name = typeof symbol_or_name === 'string' && !symbol_or_name.includes(':')
    ? symbol_or_name
    : symbol_or_name.split(':').pop() || '';
  const { file_analysis, global_symbols, config, language } = context;

  // Check if it's a special symbol
  if (is_global_symbol(symbol_name, language)) {
    return construct_symbol({
      file_path: 'global',
      name: symbol_name,
    });
  }

  if (is_builtin_symbol(symbol_name, language)) {
    return construct_symbol({
      file_path: 'builtin',
      name: symbol_name,
    });
  }

  // Get scope search order from configuration
  const search_order = get_scope_search_order(language);
  
  // Search through scopes based on configuration
  for (const order of search_order) {
    let symbol: SymbolId | undefined;

    switch (order) {
      case 'local':
        symbol = resolve_in_local_scope(symbol_name, scope_id, file_analysis);
        break;
      case 'parent':
      case 'enclosing':
        symbol = resolve_in_parent_scopes(symbol_name, scope_id, file_analysis, config);
        break;
      case 'global':
        symbol = resolve_in_global_scope(symbol_name, file_analysis, global_symbols);
        break;
      case 'builtin':
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
  scope_id: string,
  file_analysis: FileAnalysis
): SymbolId | undefined;

// Legacy overload
function resolve_in_local_scope(
  symbol_name: string,
  scope_id: string,
  file_analysis: FileAnalysis
): SymbolId | undefined;

function resolve_in_local_scope(
  symbol_or_name: SymbolId | string,
  scope_id: string,
  file_analysis: FileAnalysis
): SymbolId | undefined {
  const symbol_name = typeof symbol_or_name === 'string' && !symbol_or_name.includes(':')
    ? symbol_or_name
    : symbol_or_name.split(':').pop() || '';
  const scope = file_analysis.scopes.nodes.get(scope_id);
  if (!scope) return undefined;

  // First check if symbol exists in scope's symbol map
  if (scope.symbols && scope.symbols.has(symbol_name)) {
    return construct_function_symbol(file_analysis.file_path, symbol_name);
  }

  // Then check if symbol is defined in this scope via definitions
  for (const def of file_analysis.definitions) {
    if (def.name === symbol_name && is_definition_in_scope(def, scope)) {
      return construct_function_symbol(file_analysis.file_path, symbol_name);
    }
  }

  return undefined;
}

/**
 * Resolve symbol in parent scopes
 */
function resolve_in_parent_scopes(
  symbol: SymbolId,
  scope_id: string,
  file_analysis: FileAnalysis,
  config: SymbolResolutionConfig
): SymbolId | undefined;

function resolve_in_parent_scopes(
  symbol_name: string,
  scope_id: string,
  file_analysis: FileAnalysis,
  config: SymbolResolutionConfig
): SymbolId | undefined;

function resolve_in_parent_scopes(
  symbol_or_name: SymbolId | string,
  scope_id: string,
  file_analysis: FileAnalysis,
  config: SymbolResolutionConfig
): SymbolId | undefined {
  const symbol_name = typeof symbol_or_name === 'string' && !symbol_or_name.includes(':')
    ? symbol_or_name
    : symbol_or_name.split(':').pop() || '';
  const scope_chain = get_scope_chain(file_analysis.scopes, scope_id);

  // Skip the current scope (already checked)
  for (let i = 1; i < scope_chain.length; i++) {
    const parent_scope = scope_chain[i];

    // Check if we should stop at module boundary
    if (config.scope_traversal.stop_at_module_boundary && parent_scope.type === 'module') {
      break;
    }

    // Look for symbol in parent scope
    const symbol = resolve_in_local_scope(symbol_name, parent_scope.id, file_analysis);
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
    construct_function_symbol(file_analysis.file_path, symbol_name)
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
    if (imp.imported.some(item => item === symbol_name)) {
      // Resolve to the exported symbol
      const source_exports = context.exports_by_file.get(imp.source);
      if (source_exports) {
        for (const exp of source_exports) {
          if (exp.exported.includes(symbol_name)) {
            return construct_function_symbol(imp.source, symbol_name);
          }
        }
      }
    }

    // Check default import
    if (imp.default === symbol_name) {
      return construct_function_symbol(imp.source, 'default');
    }
  }

  return undefined;
}

/**
 * Generic method resolution
 */
function resolve_method_generic(
  call: MethodCallInfo,
  scope: ScopeNode,
  context: FileResolutionContext
): SymbolId | undefined {
  // For generic method resolution, try to find the object type
  // and then look for the method on that type
  
  if (call.object_name) {
    // Find the object's type
    const object_symbol = resolve_symbol_generic(
      call.object_name,
      scope.id,
      context
    );

    if (object_symbol) {
      // Look for method on this object/class
      return construct_method_symbol(
        context.file_analysis.file_path,
        call.object_name,
        call.method_name
      );
    }
  }

  return undefined;
}

/**
 * Check if a definition is in a given scope
 */
function is_definition_in_scope(def: Def, scope: ScopeNode): boolean {
  // Simple check - can be enhanced based on actual scope boundaries
  return true; // TODO: Implement proper scope boundary checking
}

/**
 * Placeholder for bespoke function call resolution
 */
function resolve_function_call_bespoke(
  call: FunctionCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Placeholder for bespoke method call resolution
 */
function resolve_method_call_bespoke(
  call: MethodCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Placeholder for bespoke constructor call resolution
 */
function resolve_constructor_call_bespoke(
  call: ConstructorCallInfo,
  context: FileResolutionContext
): SymbolId | undefined {
  // This will be implemented by language-specific bespoke modules
  return undefined;
}

/**
 * Create a resolution context
 */
export function create_resolution_context(
  scope_tree: ScopeTree,
  language: Language,
  file_path: string,
  root_node?: SyntaxNode,
  source_code?: string,
  imports?: ImportInfo[],
  exports?: ExportInfo[],
  module_graph?: any
): ResolutionContext {
  const config = get_symbol_resolution_config(language);
  
  return {
    scope_tree,
    language,
    file_path,
    config,
    root_node,
    source_code,
    imports,
    exports,
    module_graph,
  };
}

/**
 * Resolve symbol at a specific position
 */
export function resolve_symbol_at_position(
  position: Position,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  const scope = find_scope_at_position(context.scope_tree, position);
  if (!scope) return undefined;

  // Find symbol at this position
  // This would need actual implementation to find the symbol name at position
  // For now, return undefined
  return undefined;
}

/**
 * Generic symbol resolution entry point
 */
export function resolve_symbol(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): ResolvedSymbol | undefined {
  // Create a file resolution context
  const file_context: FileResolutionContext = {
    file_analysis: {
      file_path: context.file_path,
      language: context.language,
      scopes: context.scope_tree,
      definitions: [],
      references: [],
      function_calls: [],
      method_calls: [],
      constructor_calls: [],
      imports: [],
      exports: [],
      call_chain_heads: [],
    },
    global_symbols: new Map(),
    imports_by_file: new Map(),
    exports_by_file: new Map(),
    language: context.language,
    config: context.config,
  };

  const symbol_id = resolve_symbol_generic(symbol_name, scope_id, file_context);
  
  if (symbol_id) {
    return {
      symbol_id,
      kind: 'variable' as SymbolKind,
    };
  }

  return undefined;
}

/**
 * Find symbol definition
 */
export function find_symbol_definition(
  symbol_name: string,
  scope_id: string,
  context: ResolutionContext
): DefinitionResult | undefined {
  const resolved = resolve_symbol(symbol_name, scope_id, context);
  if (resolved) {
    return resolved;
  }
  return undefined;
}

/**
 * Go to definition
 */
export function go_to_definition(
  position: Position,
  context: ResolutionContext
): DefinitionResult | undefined {
  return resolve_symbol_at_position(position, context);
}

/**
 * Check if a symbol is exported
 */
export function is_symbol_exported(
  symbol_name: string,
  exports: readonly ExportStatement[]
): boolean {
  for (const exp of exports) {
    if (exp.exported.includes(symbol_name)) {
      return true;
    }
    if (exp.default === symbol_name) {
      return true;
    }
  }
  return false;
}

/**
 * Find all references to a symbol
 */
export function find_symbol_references(
  symbol_id: SymbolId,
  analyses: readonly FileAnalysis[]
): Ref[] {
  const refs: Ref[] = [];

  for (const analysis of analyses) {
    for (const ref of analysis.references) {
      // Check if this reference matches the symbol
      // This needs proper implementation
      refs.push(ref);
    }
  }

  return refs;
}

/**
 * Get all visible symbols from a scope
 */
export function get_all_visible_symbols(
  scope_id: string,
  context: ResolutionContext
): SymbolDefinition[] {
  const symbols: SymbolDefinition[] = [];
  const scope = context.scope_tree.nodes.get(scope_id);
  
  if (!scope) return symbols;

  // Get symbols from current scope
  for (const [name, symbol] of scope.symbols) {
    symbols.push({
      id: construct_symbol({
        file_path: context.file_path,
        name: name,
      }),
      name,
      kind: symbol.kind || 'variable',
      location: {
        file_path: context.file_path,
        range: symbol.range || { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } }
      },
    });
  }

  // Add parent scope symbols if configured
  if (context.config.scope_traversal.search_parent_scopes) {
    const parent_id = scope.parent_id;
    if (parent_id) {
      const parent_symbols = get_all_visible_symbols(parent_id, context);
      symbols.push(...parent_symbols);
    }
  }

  return symbols;
}

/**
 * Symbol registry type for mapping definitions to IDs
 */
export type SymbolRegistry = Map<any, SymbolId>;

/**
 * Build symbol registry from functions and classes
 */
export function build_symbol_registry(
  functions: FunctionDefinition[],
  classes: ClassDefinition[]
): SymbolRegistry {
  const registry: SymbolRegistry = new Map();

  // Register functions
  for (const func of functions) {
    const symbol_id = `function:${func.name}`;
    registry.set(func, symbol_id);
  }

  // Register classes and their methods
  for (const cls of classes) {
    const class_symbol_id = `class:${cls.name}`;
    registry.set(cls, class_symbol_id);

    // Register methods
    for (const method of cls.methods) {
      const method_symbol_id = `method:${cls.name}.${method.name}`;
      registry.set(method, method_symbol_id);
    }
  }

  return registry;
}

/**
 * Build symbol index from file analyses and global symbol table
 */
export function build_symbol_index(
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