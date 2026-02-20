/**
 * Utility functions for scope matching and lookup
 */

import type {
  LexicalScope,
  ScopeId,
  SymbolName,
  Location,
} from "@ariadnejs/types";
import type { CaptureNode } from "../index_single_file";

/**
 * Find the body scope for a function/method/constructor definition.
 *
 * Uses a multi-strategy approach:
 * 1. Same-line matching: Scope must start on the same line as definition ends
 * 2. Multi-line signature fallback: Allow scope to start within 5 lines (for multi-line signatures)
 * 3. Location-only fallback: Strict proximity matching without name check
 *
 * The definition location is the function NAME (identifier), not the full declaration.
 * The scope location starts at the parameters and ends at the closing brace.
 *
 * @param _capture - The definition's capture node (unused, kept for API compatibility)
 * @param scopes - All scopes in the file
 * @param def_name - Definition name (empty string or "<anonymous>" for anonymous functions)
 * @param def_location - Definition location (the function name's span)
 * @returns The matching scope ID
 */
export function find_body_scope_for_definition(
  _capture: CaptureNode,
  scopes: ReadonlyMap<ScopeId, LexicalScope>,
  def_name: SymbolName,
  def_location: Location,
): ScopeId {
  // Filter to function/method/constructor scopes only
  const callable_scopes = Array.from(scopes.values()).filter(scope =>
    scope.type === "function" || scope.type === "method" || scope.type === "constructor",
  );

  const is_anonymous = def_name === "" || def_name === "<anonymous>";

  // Strategy 0: Containment matching for anonymous functions (arrow functions)
  // For arrow functions, the definition location spans the entire arrow function node,
  // and the scope location also spans from params to body end. The scope CONTAINS
  // the definition rather than starting AFTER it.
  if (is_anonymous) {
    const containment_candidates: { scope: LexicalScope; size: number }[] = [];

    for (const scope of callable_scopes) {
      const scope_is_anonymous = scope.name === null || scope.name === "";
      if (!scope_is_anonymous) continue;

      // Check if scope contains or overlaps with definition
      // Scope must start at or before definition starts AND end at or after definition ends
      const scope_contains_def =
        scope.location.start_line <= def_location.start_line &&
        scope.location.end_line >= def_location.end_line &&
        // For same start line, scope must start at or before definition
        (scope.location.start_line < def_location.start_line ||
          scope.location.start_column <= def_location.start_column) &&
        // For same end line, scope must end at or after definition
        (scope.location.end_line > def_location.end_line ||
          scope.location.end_column >= def_location.end_column);

      if (scope_contains_def) {
        // Prefer smaller scopes (more precise match)
        const size =
          (scope.location.end_line - scope.location.start_line) * 10000 +
          (scope.location.end_column - scope.location.start_column);
        containment_candidates.push({ scope, size });
      }
    }

    if (containment_candidates.length > 0) {
      // Pick the smallest containing scope
      containment_candidates.sort((a, b) => a.size - b.size);
      return containment_candidates[0].scope.id;
    }
  }

  // Strategy 1: Same-line + exact name match
  // The scope should start on the same line as the definition ends
  let candidates: { scope: LexicalScope; distance: number }[] = [];

  for (const scope of callable_scopes) {
    // Scope must start on same line as definition ends
    if (scope.location.start_line !== def_location.end_line) continue;

    // Scope must start after definition ends (or at same column for edge cases)
    if (scope.location.start_column < def_location.end_column) continue;

    const distance = scope.location.start_column - def_location.end_column;

    // Name matching: exact for named, both-anonymous for anonymous
    const scope_is_anonymous = scope.name === null || scope.name === "";

    if ((is_anonymous && scope_is_anonymous) ||
        (!is_anonymous && scope.name === def_name)) {
      candidates.push({ scope, distance });
    }
  }

  // Among candidates, pick the one with smallest distance
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].scope.id;
  }

  // Strategy 2: Multi-line signature fallback
  // For functions with multi-line signatures, allow scope to start within 5 lines
  candidates = [];
  for (const scope of callable_scopes) {
    const line_diff = scope.location.start_line - def_location.end_line;

    // Allow up to 5 lines for multi-line signatures
    if (line_diff < 0 || line_diff > 5) continue;

    // Calculate distance (line-major)
    const distance = line_diff * 10000 + (scope.location.start_column || 0);

    const scope_is_anonymous = scope.name === null || scope.name === "";

    if ((is_anonymous && scope_is_anonymous) ||
        (!is_anonymous && scope.name === def_name)) {
      candidates.push({ scope, distance });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0].scope.id;
  }

  // Strategy 3: Location-only fallback (strict distance + at least one anonymous)
  // For edge cases where name extraction differs between definition and scope
  // Only applies when at least one side is anonymous (to avoid false matches)
  const location_candidates: { scope: LexicalScope; line_diff: number }[] = [];

  for (const scope of callable_scopes) {
    const line_diff = scope.location.start_line - def_location.end_line;

    // Must be on same line or within 2 lines
    if (line_diff < 0 || line_diff > 2) continue;

    // Must start after definition ends (if on same line)
    if (line_diff === 0 && scope.location.start_column < def_location.end_column) continue;

    // At least one side must be anonymous to avoid false matches
    // This handles cases where tree-sitter captures name differently
    const scope_is_anonymous = scope.name === null || scope.name === "";
    if (!is_anonymous && !scope_is_anonymous) continue;

    location_candidates.push({ scope, line_diff });
  }

  if (location_candidates.length > 0) {
    // Sort by line_diff, then by start_column to get closest match
    location_candidates.sort((a, b) => {
      if (a.line_diff !== b.line_diff) return a.line_diff - b.line_diff;
      return a.scope.location.start_column - b.scope.location.start_column;
    });
    return location_candidates[0].scope.id;
  }

  throw new Error(
    `No body scope found for ${def_name} at ${def_location.file_path}:${def_location.start_line}`,
  );
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