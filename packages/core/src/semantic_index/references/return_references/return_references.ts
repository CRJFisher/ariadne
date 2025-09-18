/**
 * Return References - Track return statements and infer return types
 */

import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import type { TypeInfo, ReturnContext } from "../type_tracking";
import { build_typed_return_map } from "../type_tracking";

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

  /** Inferred return type */
  readonly returned_type?: TypeInfo;

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
  file_path: FilePath,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): ReturnReference[] {
  const return_refs: ReturnReference[] = [];

  // Build return context map
  const return_map = build_typed_return_map(returns, root_scope, scopes);

  for (const capture of returns) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    const key = location_key(capture.node_location);
    const return_context = return_map.get(key);

    if (return_context) {
      const return_ref = create_return_reference(
        capture,
        scope,
        return_context,
        scope_to_symbol
      );

      return_refs.push(return_ref);
    }
  }

  return return_refs;
}

/**
 * Create a return reference
 */
function create_return_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  return_context: ReturnContext,
  scope_to_symbol?: Map<ScopeId, SymbolId>
): ReturnReference {
  const location = capture.node_location;
  const expression = capture.text;

  // Get function symbol if available
  const function_symbol = scope_to_symbol?.get(return_context.function_scope_id);

  return {
    location,
    expression,
    scope_id: scope.id,
    function_scope_id: return_context.function_scope_id,
    function_symbol,
    returned_type: return_context.returned_type,
    is_conditional: return_context.is_conditional || false,
    is_async: false, // Would need function analysis
    is_yield: false, // Would need to check for yield keyword
  };
}

/**
 * Infer function return type from all returns
 */
export interface InferredReturnType {
  function_scope_id: ScopeId;
  function_symbol?: SymbolId;
  return_types: TypeInfo[];
  unified_type?: TypeInfo;
}

export function infer_function_return_types(
  returns: ReturnReference[]
): Map<ScopeId, InferredReturnType> {
  const function_returns = new Map<ScopeId, InferredReturnType>();

  for (const ret of returns) {
    if (!function_returns.has(ret.function_scope_id)) {
      function_returns.set(ret.function_scope_id, {
        function_scope_id: ret.function_scope_id,
        function_symbol: ret.function_symbol,
        return_types: [],
      });
    }

    const inferred = function_returns.get(ret.function_scope_id)!;
    if (ret.returned_type) {
      inferred.return_types.push(ret.returned_type);
    }
  }

  // Unify return types for each function
  for (const inferred of function_returns.values()) {
    inferred.unified_type = unify_types(inferred.return_types);
  }

  return function_returns;
}

/**
 * Simple type unification
 */
function unify_types(types: TypeInfo[]): TypeInfo | undefined {
  if (types.length === 0) return undefined;
  if (types.length === 1) return types[0];

  // Check if all types are the same
  const first = types[0];
  const all_same = types.every(t => t.type_name === first.type_name);

  if (all_same) {
    return first;
  }

  // Create union type
  return {
    type_name: "union" as SymbolName,
    certainty: "inferred",
    source: {
      kind: "return",
      location: types[0].source.location,
    },
    type_args: types,
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

  // Check if function might have implicit return (no return statement on some paths)
  // This would need control flow analysis to be accurate
  const has_implicit_return = has_conditional_returns && paths.length === 1;

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