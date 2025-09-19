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
  SymbolDefinition,
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
  _file_path: FilePath,
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

    // Skip captures where scope cannot be determined
    if (!scope) {
      continue;
    }

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

  // Detect async and yield patterns from the expression
  const is_async = is_async_return(expression);
  const is_yield = is_yield_return(expression);

  return {
    location,
    expression,
    scope_id: scope.id,
    function_scope_id: return_context.function_scope_id,
    function_symbol,
    returned_type: return_context.returned_type,
    is_conditional: return_context.is_conditional || false,
    is_async,
    is_yield,
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
  resolved_type?: TypeInfo;
}

export function infer_function_return_types(
  returns: readonly ReturnReference[]
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
 * Check if two TypeInfo objects are structurally equal
 */
function types_equal(a: TypeInfo, b: TypeInfo): boolean {
  if (a.type_name !== b.type_name) return false;

  // Compare type arguments if they exist
  if (a.type_params && b.type_params) {
    if (a.type_params.length !== b.type_params.length) return false;
    return a.type_params.every((arg, i) => types_equal(arg, b.type_params![i]));
  }

  // If one has type_args and the other doesn't, they're different
  if (a.type_params || b.type_params) return false;

  return true;
}

/**
 * Simple type unification
 */
function unify_types(types: TypeInfo[]): TypeInfo | undefined {
  if (types.length === 0) return undefined;
  if (types.length === 1) return types[0];

  // Check if all types are structurally the same
  const first = types[0];
  const all_same = types.every(t => types_equal(t, first));

  if (all_same) {
    return first;
  }

  // Create union type
  const type_names = types.map(t => t.type_name);
  const union_name = type_names.join(" | ") as SymbolName;

  return {
    type_name: union_name,
    certainty: "inferred",
    source: {
      kind: "return",
      location: types[0].source.location,
    },
    union_members: types,
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

/**
 * Connect inferred return types to function symbols
 */
export function connect_return_types_to_functions(
  returns: readonly ReturnReference[],
  symbols: Map<SymbolId, SymbolDefinition>,
  type_registry?: { resolve_type_info?: (info: TypeInfo) => TypeInfo | undefined }
): Map<SymbolId, TypeInfo> {
  const function_return_types = new Map<SymbolId, TypeInfo>();

  // First, infer return types for each function
  const inferred = infer_function_return_types(returns);

  // Then connect them to function symbols
  for (const [, inferred_type] of inferred) {
    if (inferred_type.function_symbol) {
      const symbol = symbols.get(inferred_type.function_symbol);
      if (symbol) {
        // Try to resolve the unified type
        if (inferred_type.unified_type && type_registry?.resolve_type_info) {
          const resolved = type_registry.resolve_type_info(inferred_type.unified_type);
          if (resolved) {
            // Store the resolved type mapping (without mutating input symbols)
            function_return_types.set(inferred_type.function_symbol, resolved);
            inferred_type.resolved_type = resolved;
          }
        }
      }
    }
  }

  return function_return_types;
}