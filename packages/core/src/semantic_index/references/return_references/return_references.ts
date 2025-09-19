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
import type { NormalizedCapture } from "../../capture_types";

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

  /** Whether in conditional branch */
  readonly is_conditional: boolean;

  /** For async functions */
  readonly is_async: boolean;

  /** For generators */
  readonly is_yield: boolean;
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
 * Detect if return expression contains async patterns
 */
function is_async_return(expression: string): boolean {
  // Check for await keyword in the return expression
  return /\bawait\b/.test(expression);
}

/**
 * Detect if return expression is actually a yield
 */
function is_yield_return(expression: string): boolean {
  // Check if expression starts with 'yield' or contains 'yield'
  return /^yield\b|\byield\b/.test(expression);
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
    if (current.type === "function" || current.type === "method" || current.type === "constructor") {
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

  // Detect async and yield patterns from the expression
  const is_async = is_async_return(expression);
  const is_yield = is_yield_return(expression);

  return {
    location,
    expression,
    scope_id: scope.id,
    function_scope_id,
    function_symbol,
    is_conditional: false, // Note: Control flow analysis happens in symbol_resolution
    is_async,
    is_yield,
  };
}


/**
 * Get all return paths for a function
 */
export interface ReturnPath {
  function_scope_id: ScopeId;
  paths: ReturnReference[];
  has_conditional_returns: boolean;
  has_implicit_return: boolean;
}

export function analyze_return_paths(
  returns: ReturnReference[],
  function_scope_id: ScopeId
): ReturnPath {
  const paths = returns.filter(r => r.function_scope_id === function_scope_id);

  const has_conditional_returns = paths.some(p => p.is_conditional);
  const has_unconditional_returns = paths.some(p => !p.is_conditional);

  // Check if function might have implicit return (no return statement on some paths)
  // - If no returns at all, definitely has implicit return
  // - If all returns are conditional, might have code paths without explicit returns
  // - If there's at least one unconditional return, all paths should have explicit returns
  const has_implicit_return = paths.length === 0 || (has_conditional_returns && !has_unconditional_returns);

  return {
    function_scope_id,
    paths,
    has_conditional_returns,
    has_implicit_return,
  };
}

/**
 * Find functions that never return (infinite loops, always throw, etc.)
 */
export function find_never_returning_functions(
  returns: ReturnReference[],
  all_function_scopes: Set<ScopeId>
): Set<ScopeId> {
  const functions_with_returns = new Set<ScopeId>();

  for (const ret of returns) {
    functions_with_returns.add(ret.function_scope_id);
  }

  const never_returning = new Set<ScopeId>();
  for (const scope_id of all_function_scopes) {
    if (!functions_with_returns.has(scope_id)) {
      never_returning.add(scope_id);
    }
  }

  return never_returning;
}

