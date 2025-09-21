/**
 * Scope chain traversal for symbol resolution
 */

import type {
  ScopeId,
  LexicalScope,
  SymbolId,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";

import type {
  ScopeResolutionContext,
  SymbolLookupResult,
  ScopeWalkOptions,
} from "./scope_types";

import { find_hoisted_symbol_in_scope } from "./hoisting_handler";

/**
 * Resolve a symbol by walking up the scope chain
 *
 * @param symbol_name - The name to resolve
 * @param starting_scope - The scope to start searching from
 * @param context - Resolution context with scopes and symbols
 * @param options - Configuration for scope walking
 * @returns The resolved symbol or null if not found
 */
export function resolve_symbol_in_scope_chain(
  symbol_name: SymbolName,
  starting_scope: LexicalScope,
  context: ScopeResolutionContext,
  options: ScopeWalkOptions = { include_hoisted: true }
): SymbolLookupResult | null {
  const visited = options.visited_tracker || new Set<ScopeId>();
  let current_scope: LexicalScope | undefined = starting_scope;
  let depth = 0;

  while (current_scope && !visited.has(current_scope.id)) {
    // Check depth limit
    if (options.max_depth !== undefined && depth >= options.max_depth) {
      break;
    }

    visited.add(current_scope.id);

    // 1. Try direct symbol lookup in current scope
    const direct_result = find_symbol_in_scope(
      symbol_name,
      current_scope,
      context.symbols
    );

    if (direct_result) {
      return {
        symbol_id: direct_result,
        scope_id: current_scope.id,
        resolution_method: "lexical",
        visibility: depth === 0 ? "local" : "closure"
      };
    }

    // 2. Try hoisted symbols if enabled
    if (options.include_hoisted) {
      const hoisted_result = find_hoisted_symbol_in_scope(
        symbol_name,
        current_scope,
        context
      );

      if (hoisted_result) {
        return {
          symbol_id: hoisted_result,
          scope_id: current_scope.id,
          resolution_method: "hoisted",
          visibility: depth === 0 ? "local" : "closure"
        };
      }
    }

    // Move to parent scope
    current_scope = current_scope.parent_id
      ? context.scopes.get(current_scope.parent_id)
      : undefined;
    depth++;
  }

  return null;
}

/**
 * Find a symbol directly defined in a scope
 *
 * @param symbol_name - The name to find
 * @param scope - The scope to search in
 * @param symbols - Symbol table
 * @returns The symbol ID if found, null otherwise
 */
function find_symbol_in_scope(
  symbol_name: SymbolName,
  scope: LexicalScope,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Check the scope's symbol map first
  const scope_symbol = scope.symbols.get(symbol_name);
  if (scope_symbol) {
    return scope_symbol.id;
  }

  // Fallback to checking all symbols in case scope.symbols isn't populated
  const symbol_entries = Array.from(symbols.entries());
  for (const [symbol_id, symbol_def] of symbol_entries) {
    if (symbol_def.scope_id === scope.id && symbol_def.name === symbol_name) {
      return symbol_id;
    }
  }

  return null;
}

/**
 * Get all symbols visible from a scope (including parent scopes)
 *
 * @param scope - Starting scope
 * @param context - Resolution context
 * @param include_hoisted - Include hoisted symbols
 * @returns Map of visible symbol names to their IDs
 */
export function get_visible_symbols(
  scope: LexicalScope,
  context: ScopeResolutionContext,
  include_hoisted: boolean = true
): Map<SymbolName, SymbolId> {
  const visible_symbols = new Map<SymbolName, SymbolId>();
  const visited = new Set<ScopeId>();
  let current_scope: LexicalScope | undefined = scope;

  while (current_scope && !visited.has(current_scope.id)) {
    visited.add(current_scope.id);

    // Add direct symbols from this scope
    const symbol_entries = Array.from(current_scope.symbols.entries());
    for (const [name, symbol] of symbol_entries) {
      if (!visible_symbols.has(name)) {
        visible_symbols.set(name, symbol.id);
      }
    }

    // Add hoisted symbols if enabled
    if (include_hoisted) {
      // Check all symbols for hoisting
      const ctx_symbol_entries = Array.from(context.symbols.entries());
      for (const [symbol_id, symbol_def] of ctx_symbol_entries) {
        if (symbol_def.scope_id === current_scope.id &&
            symbol_def.is_hoisted &&
            !visible_symbols.has(symbol_def.name)) {
          visible_symbols.set(symbol_def.name, symbol_id);
        }
      }
    }

    // Move to parent scope
    current_scope = current_scope.parent_id
      ? context.scopes.get(current_scope.parent_id)
      : undefined;
  }

  return visible_symbols;
}

/**
 * Find the nearest enclosing scope of a specific type
 *
 * @param starting_scope - The scope to start from
 * @param scope_type - The type of scope to find
 * @param scopes - Map of all scopes
 * @returns The nearest scope of the given type or null
 */
export function find_enclosing_scope_of_type(
  starting_scope: LexicalScope,
  scope_type: LexicalScope["type"],
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope | null {
  let current_scope: LexicalScope | undefined = starting_scope;
  const visited = new Set<ScopeId>();

  while (current_scope && !visited.has(current_scope.id)) {
    visited.add(current_scope.id);

    if (current_scope.type === scope_type) {
      return current_scope;
    }

    current_scope = current_scope.parent_id
      ? scopes.get(current_scope.parent_id)
      : undefined;
  }

  return null;
}

/**
 * Check if a scope is a descendant of another scope
 *
 * @param descendant - Potential descendant scope
 * @param ancestor - Potential ancestor scope
 * @param scopes - Map of all scopes
 * @returns True if descendant is a descendant of ancestor
 */
export function is_scope_descendant(
  descendant: LexicalScope,
  ancestor: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): boolean {
  let current_scope: LexicalScope | undefined = descendant;
  const visited = new Set<ScopeId>();

  while (current_scope && !visited.has(current_scope.id)) {
    visited.add(current_scope.id);

    if (current_scope.id === ancestor.id) {
      return true;
    }

    current_scope = current_scope.parent_id
      ? scopes.get(current_scope.parent_id)
      : undefined;
  }

  return false;
}

/**
 * Collect all child scopes recursively
 *
 * @param scope - The parent scope
 * @param scopes - Map of all scopes
 * @returns Array of all descendant scopes
 */
export function collect_descendant_scopes(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): LexicalScope[] {
  const descendants: LexicalScope[] = [];
  const to_visit: ScopeId[] = [...scope.child_ids];
  const visited = new Set<ScopeId>();

  while (to_visit.length > 0) {
    const scope_id = to_visit.pop()!;
    if (visited.has(scope_id)) {
      continue;
    }
    visited.add(scope_id);

    const child_scope = scopes.get(scope_id);
    if (child_scope) {
      descendants.push(child_scope);
      to_visit.push(...child_scope.child_ids);
    }
  }

  return descendants;
}