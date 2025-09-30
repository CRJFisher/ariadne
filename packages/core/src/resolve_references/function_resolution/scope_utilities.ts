/**
 * Utility functions for scope analysis
 */

import type {
  FilePath,
  Location,
  ScopeId,
  LexicalScope,
  SymbolId,
  SymbolDefinition,
} from "@ariadnejs/types";

import type { ScopeAnalysis } from "./scope_types";

/**
 * Find the containing function scope for a location
 *
 * @param location - The location to check
 * @param scopes - Map of all scopes
 * @returns The containing function scope or null
 */
export function find_containing_function_scope(
  location: Location,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  // Find the nearest function scope that contains this location
  const scope_array = Array.from(scopes.values());
  for (const scope of scope_array) {
    if (
      (scope.type === "function" ||
        scope.type === "method" ||
        scope.type === "constructor") &&
      location_in_scope(location, scope)
    ) {
      return scope;
    }
  }
  return null;
}

/**
 * Get the scope chain from a scope to the root
 *
 * @param scope - Starting scope
 * @param scopes - Map of all scopes
 * @returns Array of scopes from the given scope to root
 */
export function get_scope_chain(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope[] {
  const chain: LexicalScope[] = [];
  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return chain;
}

/**
 * Check if a location falls within a scope
 *
 * @param location - The location to check
 * @param scope - The scope to check against
 * @returns True if the location is within the scope
 */
export function location_in_scope(
  location: Location,
  scope: LexicalScope
): boolean {
  // Check if location falls within scope boundaries
  const scope_loc = scope.location;

  // Check file path first
  if (location.file_path !== scope_loc.file_path) {
    return false;
  }

  // Check if location is after scope start
  if (
    location.start_line < scope_loc.start_line ||
    (location.start_line === scope_loc.start_line &&
      location.start_column < scope_loc.start_column)
  ) {
    return false;
  }

  // Check if location is before scope end
  if (
    location.end_line > scope_loc.end_line ||
    (location.end_line === scope_loc.end_line &&
      location.end_column > scope_loc.end_column)
  ) {
    return false;
  }

  return true;
}

/**
 * Check if a scope is at the global/module level
 *
 * @param scope - The scope to check
 * @returns True if this is a global or module scope
 */
export function is_global_scope(scope: LexicalScope): boolean {
  return (
    scope.type === "module" ||
    scope.type === "global" ||
    scope.parent_id === null
  );
}

/**
 * Get all function scopes in a file
 *
 * @param scopes - Map of all scopes
 * @param file_path - The file to filter by
 * @returns Array of function scopes in the file
 */
export function get_function_scopes_in_file(
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  file_path: FilePath
): LexicalScope[] {
  return Array.from(scopes.values()).filter(
    (scope) =>
      (scope.type === "function" ||
        scope.type === "method" ||
        scope.type === "constructor") &&
      scope.location.file_path === file_path
  );
}

/**
 * Find the scope at a specific location
 *
 * @param location - The location to find the scope for
 * @param scopes - Map of all scopes
 * @returns The most specific scope containing the location
 */
export function find_scope_at_location(
  location: Location,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  let best_scope: LexicalScope | null = null;
  let best_size = Infinity;

  const scope_array = Array.from(scopes.values());
  for (const scope of scope_array) {
    if (location_in_scope(location, scope)) {
      // Calculate scope size (smaller is more specific)
      const size = calculate_scope_size(scope);
      if (size < best_size) {
        best_scope = scope;
        best_size = size;
      }
    }
  }

  return best_scope;
}

/**
 * Calculate the size of a scope (for specificity comparison)
 */
function calculate_scope_size(scope: LexicalScope): number {
  const loc = scope.location;
  const line_span = loc.end_line - loc.start_line;
  const col_span = loc.end_column - loc.start_column;
  return line_span * 1000 + col_span; // Prioritize line span over column span
}

/**
 * Analyze scopes for a location
 *
 * @param location - The location to analyze
 * @param scopes - Map of all scopes
 * @param root_scope_id - The root scope ID for the file
 * @returns Analysis of scopes at the location
 */
export function analyze_scopes_at_location(
  location: Location,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  root_scope_id: ScopeId
): ScopeAnalysis {
  const immediate_scope = find_scope_at_location(location, scopes);
  const function_scope = immediate_scope
    ? find_nearest_function_scope(immediate_scope, scopes)
    : null;

  const containing_scopes: ScopeId[] = [];
  if (immediate_scope) {
    const chain = get_scope_chain(immediate_scope, scopes);
    containing_scopes.push(...chain.map((s) => s.id));
  }

  return {
    containing_scopes,
    immediate_scope: immediate_scope?.id || null,
    function_scope: function_scope?.id || null,
    module_scope: root_scope_id,
  };
}

/**
 * Find the nearest function scope
 */
function find_nearest_function_scope(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (
      current.type === "function" ||
      current.type === "method" ||
      current.type === "constructor"
    ) {
      return current;
    }

    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return null;
}

/**
 * Get all symbols defined in a scope (including child scopes)
 *
 * @param scope - The scope to analyze
 * @param symbols - Symbol table
 * @param include_children - Include symbols from child scopes
 * @returns Array of symbols in the scope
 */
export function get_symbols_in_scope(
  scope: LexicalScope,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  include_children: boolean = false
): SymbolDefinition[] {
  const scope_symbols: SymbolDefinition[] = [];

  // Add direct symbols
  const symbol_entries = Array.from(symbols.entries());
  for (const [symbol_id, symbol_def] of symbol_entries) {
    if (symbol_def.scope_id === scope.id) {
      scope_symbols.push(symbol_def);
    }
  }

  // Add symbols from child scopes if requested
  if (include_children) {
    for (const child_id of scope.child_ids) {
      const symbol_entries = Array.from(symbols.entries());
      for (const [symbol_id, symbol_def] of symbol_entries) {
        if (symbol_def.scope_id === child_id) {
          scope_symbols.push(symbol_def);
        }
      }
    }
  }

  return scope_symbols;
}

/**
 * Get the depth of a scope in the tree
 *
 * @param scope - The scope to measure
 * @param scopes - Map of all scopes
 * @returns The depth (0 for root)
 */
export function get_scope_depth(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): number {
  let depth = 0;
  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>();

  while (current?.parent_id && !visited.has(current.id)) {
    visited.add(current.id);
    depth++;
    current = scopes.get(current.parent_id);
  }

  return depth;
}

/**
 * Find common ancestor scope of two scopes
 *
 * @param scope1 - First scope
 * @param scope2 - Second scope
 * @param scopes - Map of all scopes
 * @returns The common ancestor or null
 */
export function find_common_ancestor_scope(
  scope1: LexicalScope,
  scope2: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  // Get chain from scope1 to root
  const chain1 = get_scope_chain(scope1, scopes);
  const chain1_ids = new Set(chain1.map((s) => s.id));

  // Walk up from scope2 until we find a common scope
  let current: LexicalScope | undefined = scope2;
  const visited = new Set<ScopeId>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (chain1_ids.has(current.id)) {
      return current;
    }

    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return null;
}

/**
 * Check if a symbol is accessible from a scope
 *
 * @param symbol - The symbol to check
 * @param from_scope - The scope to check from
 * @param scopes - Map of all scopes
 * @returns True if the symbol is accessible
 */
export function is_symbol_accessible_from_scope(
  symbol: SymbolDefinition,
  from_scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): boolean {
  // Get the scope containing the symbol
  const symbol_scope = scopes.get(symbol.scope_id);
  if (!symbol_scope) {
    return false;
  }

  // Check if from_scope is a descendant of symbol_scope
  let current: LexicalScope | undefined = from_scope;
  const visited = new Set<ScopeId>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.id === symbol_scope.id) {
      return true;
    }

    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  // Symbol is not in an ancestor scope
  return false;
}
