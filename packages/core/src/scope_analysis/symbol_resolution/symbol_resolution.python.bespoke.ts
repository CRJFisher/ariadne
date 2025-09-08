/**
 * Python-specific bespoke symbol resolution
 * 
 * This module handles ONLY Python-specific features that cannot be
 * expressed through configuration:
 * - LEGB (Local, Enclosing, Global, Built-in) rule
 * - global and nonlocal declarations
 * - __all__ exports
 */

import { SyntaxNode } from 'tree-sitter';
import { Position, SymbolId, Def, SymbolKind } from '@ariadnejs/types';
import {
  FileResolutionContext,
  ResolvedSymbol,
} from './symbol_resolution';
import {
  ScopeNode,
  get_scope_chain,
} from '../scope_tree';
import {
  construct_function_symbol,
  construct_symbol,
} from '../../utils/symbol_construction';

/**
 * Handle Python's LEGB rule
 * Searches for symbols in order: Local -> Enclosing -> Global -> Built-in
 */
export function handle_python_legb(
  symbol_name: string,
  scope_id: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  const scope_chain = get_scope_chain(file_analysis.scopes, scope_id);
  
  // Check for global/nonlocal declarations that affect resolution
  const global_declarations = extract_global_declarations(file_analysis);
  const nonlocal_declarations = extract_nonlocal_declarations(file_analysis);
  
  // 1. Local scope
  const current_scope = scope_chain[0];
  if (current_scope) {
    // Check if symbol is declared as global or nonlocal in this scope
    if (is_declared_global(symbol_name, current_scope.id, global_declarations)) {
      // Skip to global scope
      return search_global_scope(symbol_name, file_analysis);
    }
    
    if (is_declared_nonlocal(symbol_name, current_scope.id, nonlocal_declarations)) {
      // Skip local, search enclosing scopes
      return search_enclosing_scopes(symbol_name, scope_chain.slice(1), file_analysis);
    }
    
    // Normal local lookup
    const local_symbol = search_in_scope(symbol_name, current_scope, file_analysis);
    if (local_symbol) return local_symbol;
  }
  
  // 2. Enclosing scopes (for nested functions)
  const enclosing_symbol = search_enclosing_scopes(symbol_name, scope_chain.slice(1), file_analysis);
  if (enclosing_symbol) return enclosing_symbol;
  
  // 3. Global scope (module level)
  const global_symbol = search_global_scope(symbol_name, file_analysis);
  if (global_symbol) return global_symbol;
  
  // 4. Built-in scope
  if (is_python_builtin(symbol_name)) {
    return construct_symbol({
      file_path: 'builtin',
      name: symbol_name,
    });
  }
  
  return undefined;
}

/**
 * Handle global declarations
 * 'global x' makes x refer to the module-level binding
 */
export function handle_global_nonlocal(
  symbol_name: string,
  declaration_type: 'global' | 'nonlocal',
  scope_id: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  if (declaration_type === 'global') {
    // Resolve to module-level symbol
    return search_global_scope(symbol_name, file_analysis);
  } else {
    // nonlocal - resolve to enclosing scope
    const scope_chain = get_scope_chain(file_analysis.scopes, scope_id);
    return search_enclosing_scopes(symbol_name, scope_chain.slice(1), file_analysis);
  }
}

/**
 * Handle __all__ exports
 * Python uses __all__ list to specify public exports
 */
export function handle_all_exports(
  context: FileResolutionContext
): string[] {
  const { file_analysis } = context;
  const exported_symbols: string[] = [];
  
  // Find __all__ definition
  const all_def = file_analysis.definitions.find(
    (def: Def) => def.name === '__all__' && def.kind === 'variable'
  );
  
  if (all_def) {
    // Parse the __all__ list
    // This would need AST analysis to extract the list contents
    // For now, return empty array
    return exported_symbols;
  }
  
  // If no __all__, all top-level non-private symbols are exported
  for (const def of file_analysis.definitions) {
    if (!def.name.startsWith('_') && is_module_level(def, file_analysis)) {
      exported_symbols.push(def.name);
    }
  }
  
  return exported_symbols;
}

// Helper functions

/**
 * Search for symbol in a specific scope
 */
function search_in_scope(
  symbol_name: string,
  scope: ScopeNode,
  file_analysis: any
): SymbolId | undefined {
  // Look for definitions in this scope
  for (const def of file_analysis.definitions) {
    if (def.name === symbol_name) {
      // Check if definition is in this scope
      // This would need proper scope boundary checking
      return construct_function_symbol(file_analysis.file_path, symbol_name);
    }
  }
  return undefined;
}

/**
 * Search enclosing scopes (for nested functions)
 */
function search_enclosing_scopes(
  symbol_name: string,
  scope_chain: ScopeNode[],
  file_analysis: any
): SymbolId | undefined {
  for (const scope of scope_chain) {
    // Skip class scopes (they don't participate in LEGB for nested functions)
    if (scope.type === 'class') continue;
    
    // Stop at module boundary
    if (scope.type === 'module') break;
    
    const symbol = search_in_scope(symbol_name, scope, file_analysis);
    if (symbol) return symbol;
  }
  return undefined;
}

/**
 * Search global (module) scope
 */
function search_global_scope(
  symbol_name: string,
  file_analysis: any
): SymbolId | undefined {
  // Find module-level definitions
  for (const def of file_analysis.definitions) {
    if (def.name === symbol_name && is_module_level(def, file_analysis)) {
      return construct_function_symbol(file_analysis.file_path, symbol_name);
    }
  }
  return undefined;
}

/**
 * Extract global declarations from file
 */
function extract_global_declarations(file_analysis: any): Map<string, Set<string>> {
  // Map from scope_id to set of global variable names
  const globals = new Map<string, Set<string>>();
  
  // This would need AST analysis to find 'global x, y, z' statements
  // For now, return empty map
  return globals;
}

/**
 * Extract nonlocal declarations from file
 */
function extract_nonlocal_declarations(file_analysis: any): Map<string, Set<string>> {
  // Map from scope_id to set of nonlocal variable names
  const nonlocals = new Map<string, Set<string>>();
  
  // This would need AST analysis to find 'nonlocal x, y, z' statements
  // For now, return empty map
  return nonlocals;
}

/**
 * Check if a symbol is declared as global in a scope
 */
function is_declared_global(
  symbol_name: string,
  scope_id: string,
  global_declarations: Map<string, Set<string>>
): boolean {
  const scope_globals = global_declarations.get(scope_id);
  return scope_globals ? scope_globals.has(symbol_name) : false;
}

/**
 * Check if a symbol is declared as nonlocal in a scope
 */
function is_declared_nonlocal(
  symbol_name: string,
  scope_id: string,
  nonlocal_declarations: Map<string, Set<string>>
): boolean {
  const scope_nonlocals = nonlocal_declarations.get(scope_id);
  return scope_nonlocals ? scope_nonlocals.has(symbol_name) : false;
}

/**
 * Check if a definition is at module level
 */
function is_module_level(def: Def, file_analysis: any): boolean {
  // This would need to check if the definition's scope is the module scope
  // For now, simplified check
  return true;
}

/**
 * Check if a symbol is a Python built-in
 */
function is_python_builtin(symbol_name: string): boolean {
  const builtins = [
    'print', 'len', 'range', 'int', 'str', 'list', 'dict', 'set',
    'tuple', 'bool', 'float', 'type', 'object', 'None', 'True', 'False',
    'open', 'input', 'abs', 'all', 'any', 'min', 'max', 'sum',
    'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
  ];
  return builtins.includes(symbol_name);
}

/**
 * Handle Python comprehensions
 * List/dict/set comprehensions create their own local scope
 */
export function handle_comprehension_scope(
  symbol_name: string,
  comprehension_node: SyntaxNode,
  context: FileResolutionContext
): SymbolId | undefined {
  // Comprehensions have their own scope for iteration variables
  // but can access enclosing scope for other variables
  
  // This would need AST analysis to determine if symbol is
  // the iteration variable or accessed from outer scope
  return undefined;
}

/**
 * Handle Python decorators
 * Decorators are functions that modify other functions/classes
 */
export function handle_python_decorators(
  decorator_name: string,
  context: FileResolutionContext
): SymbolId | undefined {
  const { file_analysis } = context;
  
  // Decorators can be imported or defined locally
  // First check imports
  for (const imp of file_analysis.imports) {
    if (imp.imported.includes(decorator_name)) {
      return construct_function_symbol(imp.source, decorator_name);
    }
  }
  
  // Then check local definitions
  const decorator_def = file_analysis.definitions.find(
    (def: Def) => def.name === decorator_name && def.kind === 'function'
  );
  
  if (decorator_def) {
    return construct_function_symbol(file_analysis.file_path, decorator_name);
  }
  
  // Check if it's a built-in decorator
  const builtin_decorators = ['property', 'staticmethod', 'classmethod'];
  if (builtin_decorators.includes(decorator_name)) {
    return construct_symbol({
      file_path: 'builtin',
      name: decorator_name,
    });
  }
  
  return undefined;
}