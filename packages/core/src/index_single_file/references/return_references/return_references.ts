/**
 * Return References - Track return statements and infer return types
 */

import type {
  Location,
  FilePath,
  ScopeId,
  LexicalScope,
  SymbolId,
} from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../query_code_tree/capture_types";

/**
 * Return reference - Represents a return statement
 */
export interface ReturnReference {
  /** Return statement location */
  readonly location: Location;

  /** Returned expression text */
  readonly expression: string;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Containing function scope */
  readonly function_scope_id: ScopeId;

  /** Containing function symbol */
  readonly function_symbol?: SymbolId;
}

/**
 * Process return references
 */
export function process_return_references(
  returns: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  _file_path: FilePath,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): ReturnReference[] {
  const return_refs: ReturnReference[] = [];

  for (const capture of returns) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    // Skip captures where scope cannot be determined
    if (!scope) {
      continue;
    }

    const return_ref = create_return_reference(
      capture,
      scope,
      scopes,
      scope_to_symbol
    );

    return_refs.push(return_ref);
  }

  return return_refs;
}

/**
 * Get the containing function scope
 */
function get_function_scope(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): ScopeId | undefined {
  let current: LexicalScope | undefined = scope;
  const visited = new Set<ScopeId>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (
      current.type === "function" ||
      current.type === "method" ||
      current.type === "constructor"
    ) {
      return current.id;
    }
    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return undefined;
}

/**
 * Create a return reference
 */
function create_return_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): ReturnReference {
  const location = capture.node_location;
  const expression = capture.text;

  // Get containing function scope
  const function_scope_id = get_function_scope(scope, scopes);
  if (!function_scope_id) {
    // Return must be in a function - use scope id as fallback
    throw new Error("Return statement not in function scope");
  }

  // Get function symbol if available
  const function_symbol = scope_to_symbol?.get(function_scope_id);

  return {
    location,
    expression,
    scope_id: scope.id,
    function_scope_id,
    function_symbol,
  };
}
