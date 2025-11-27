/**
 * Utility functions for scope matching and lookup
 */

import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import type { CaptureNode } from "../semantic_index";

/**
 * Find the body scope for a function/method/constructor definition.
 *
 * Matches by:
 * 1. Scope type (function/method/constructor)
 * 2. Scope name matches definition name
 * 3. Scope location contains or closely follows definition location
 *
 * @param capture - The definition's capture node
 * @param scopes - All scopes in the file
 * @param def_name - Definition name
 * @param def_location - Definition location
 * @returns The matching scope ID
 */
export function find_body_scope_for_definition(
  capture: CaptureNode,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  def_name: SymbolName,
  def_location: Location,
): ScopeId {
  // Filter to function/method/constructor scopes only
  const callable_scopes = Array.from(scopes.values()).filter(scope =>
    scope.type === "function" || scope.type === "method" || scope.type === "constructor",
  );

  // For scope matching, primarily use location-based matching since:
  // - Scope names often include the entire body text, not just the function name
  // - Anonymous functions don't have names
  // - Location is more reliable for matching definition to its body scope

  let best_match: LexicalScope | undefined;
  let smallest_distance = Infinity;

  for (const scope of callable_scopes) {
    // Check if scope location is close to definition location
    const distance = calculate_location_distance(def_location, scope.location);

    // More permissive distance check: allow scopes that start at/after the definition
    // or before (for edge cases in parsing where scope might encompass the definition)
    if (distance >= -100000 && distance < smallest_distance) {
      // More lenient name compatibility check
      const is_name_compatible =
        def_name === "" || // anonymous function
        scope.name === null || // no scope name
        scope.name === "" || // empty scope name
        scope.name.includes(def_name) || // scope name contains definition name
        def_name.includes(scope.name || "") || // definition name contains scope name
        (def_name && scope.name && are_names_compatible(def_name, scope.name)); // fuzzy name match

      if (is_name_compatible) {
        smallest_distance = distance;
        best_match = scope;
      }
    }
  }

  // If no match found with name compatibility, try pure location-based matching
  if (!best_match) {
    for (const scope of callable_scopes) {
      const distance = calculate_location_distance(def_location, scope.location);

      // Very permissive distance check for location-only matching
      if (distance >= -50 && distance < 1000 && distance < smallest_distance) {
        smallest_distance = distance;
        best_match = scope;
      }
    }
  }

  if (!best_match) {
    // Create debug information
    const debug_info = callable_scopes.map(scope => ({
      type: scope.type,
      name: scope.name,
      location: scope.location,
      distance: calculate_location_distance(def_location, scope.location),
    }));

    console.warn(`Debug: No body scope found for ${def_name} at ${def_location.file_path}:${def_location.start_line}`);
    console.warn("Available scopes:", debug_info);

    throw new Error(
      `No body scope found for ${def_name} at ${def_location.file_path}:${def_location.start_line}`,
    );
  }

  return best_match.id;
}

/**
 * Check if two names are compatible (handles various naming patterns)
 */
function are_names_compatible(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;

  // Exact match
  if (name1 === name2) return true;

  // Case insensitive match
  if (name1.toLowerCase() === name2.toLowerCase()) return true;

  // One contains the other
  if (name1.includes(name2) || name2.includes(name1)) return true;

  // Check if names are similar (allowing for slight variations)
  const normalized1 = name1.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const normalized2 = name2.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  return normalized1.includes(normalized2) || normalized2.includes(normalized1);
}

/**
 * Calculate distance between definition location and scope location.
 * Returns:
 * - 0 if scope starts exactly at definition
 * - Positive number if scope starts after definition (typical)
 * - Negative number if scope starts before definition (shouldn't happen)
 */
function calculate_location_distance(def_loc: Location, scope_loc: Location): number {
  const def_pos = def_loc.start_line * 10000 + def_loc.start_column;
  const scope_pos = scope_loc.start_line * 10000 + scope_loc.start_column;
  return scope_pos - def_pos;
}

/**
 * Find the enclosing function/method/constructor scope for a given scope.
 * Traverses up the scope tree until finding a callable scope.
 *
 * @param scope_id - Starting scope ID
 * @param scopes - All scopes in the file
 * @returns The enclosing function scope ID, or module scope if no function found
 */
export function find_enclosing_function_scope(
  scope_id: ScopeId,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
): ScopeId {
  let current_id: ScopeId | null = scope_id;
  const visited = new Set<ScopeId>();

  while (current_id !== null) {
    // Check for cycles to prevent infinite loops
    if (visited.has(current_id)) {
      throw new Error("Cycle detected in scope tree");
    }
    visited.add(current_id);

    const scope = scopes.get(current_id);
    if (!scope) {
      throw new Error(`Scope ${current_id} not found`);
    }

    // Check if this is a function/method/constructor scope
    if (is_function_scope(scope)) {
      return scope.id;
    }

    // Move to parent
    current_id = scope.parent_id;
  }

  // If no function scope found, return the root scope
  // This handles top-level calls (calls at module scope)
  return find_root_scope(scopes);
}

/**
 * Check if a scope is a function/method/constructor scope.
 */
function is_function_scope(scope: LexicalScope): boolean {
  return (
    scope.type === "function" ||
    scope.type === "method" ||
    scope.type === "constructor"
  );
}

/**
 * Find root scope (module scope) in a scope map.
 */
export function find_root_scope(scopes: ReadonlyMap<ScopeId, LexicalScope>): ScopeId {
  for (const scope of scopes.values()) {
    if (scope.parent_id === null) {
      return scope.id;
    }
  }
  throw new Error("No root scope found");
}