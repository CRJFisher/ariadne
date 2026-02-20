/**
 * Function Call Resolution
 *
 * Resolves bare function calls (no receiver) by:
 * 1. Resolving the function name via scope-based resolution
 * 2. Skipping method/constructor definitions (they require receivers)
 * 3. Falling back to collection dispatch and callable instance patterns
 *
 * Integration points:
 * - Uses ResolutionRegistry for EAGER O(1) name resolution
 * - Uses DefinitionRegistry for definition kind checks
 * - Uses collection dispatch for Map/Array/Object function stores
 * - Uses callable instance for Python __call__ method resolution
 */

import type {
  SymbolId,
  FunctionCallReference,
} from "@ariadnejs/types";
import type { CallResolutionContext } from "./call_resolver";
import type { ResolutionRegistry } from "../resolve_references";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_callable_instance } from "./callable_instance.python";

/**
 * Find alternative resolution by skipping method/constructor definitions.
 *
 * When a function_call resolves to a method (which requires a receiver),
 * walk up the scope tree to find an import or function with the same name.
 *
 * @param ref - The function call reference
 * @param context - Call resolution context
 * @param resolver - Name resolution provider
 * @returns The resolved SymbolId or null if no valid resolution found
 */
function find_function_resolution(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): SymbolId | null {
  const initial = resolver.resolve(ref.scope_id, ref.name);
  if (!initial) return null;

  // Check if resolution is valid for a function call
  const def = context.definitions.get(initial);
  if (!def) return initial; // Trust unresolved symbols

  // Methods and constructors require receivers - can't be called as bare functions
  if (def.kind !== "method" && def.kind !== "constructor") {
    return initial; // Valid: function, variable, import
  }

  // Resolved to method/constructor - this can't be the target of a bare function call
  // Find alternative by walking up from the class scope
  const method_body_scope = def.body_scope_id;
  if (!method_body_scope) return null;

  const body_scope = context.scopes.get_scope(method_body_scope);
  if (!body_scope?.parent_id) return null;

  // Class scope's parent should be module scope with imports
  const class_scope = context.scopes.get_scope(body_scope.parent_id);
  if (!class_scope?.parent_id) return null;

  // Try resolving from module scope (where imports live)
  const alternative = resolver.resolve(class_scope.parent_id, ref.name);
  if (!alternative) return null;

  // Verify the alternative is valid for a function call
  const alt_def = context.definitions.get(alternative);
  if (!alt_def) return alternative;

  if (alt_def.kind === "method" || alt_def.kind === "constructor") {
    return null; // Still a method/constructor - no valid resolution
  }

  return alternative;
}

/**
 * Resolve a function call to zero, one, or more symbols.
 *
 * Handles bare function calls (no receiver):
 * 1. Resolve the name, skipping method/constructor definitions
 * 2. Fall back to collection dispatch if unresolved or collection-sourced
 * 3. Fall back to Python callable instance (__call__ method)
 *
 * @param ref - Function call reference from semantic index
 * @param context - Call resolution context with all required registries
 * @param resolver - Name resolution provider
 * @returns Array of resolved symbol_ids (empty if resolution fails)
 */
export function resolve_function_call(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): SymbolId[] {
  // Step 1: Resolve function name
  const func_symbol = find_function_resolution(ref, context, resolver);

  let resolved_symbols: SymbolId[];
  if (func_symbol) {
    resolved_symbols = [func_symbol];
  } else {
    resolved_symbols = [];
  }

  // Step 2: Check for collection dispatch
  let try_dispatch = resolved_symbols.length === 0;
  if (resolved_symbols.length === 1) {
    const def = context.definitions.get(resolved_symbols[0]);
    if (
      def &&
      (def.kind === "variable" || def.kind === "constant") &&
      def.collection_source
    ) {
      try_dispatch = true;
    }
  }

  if (try_dispatch) {
    const dispatch_ids = resolve_collection_dispatch(
      ref,
      context.definitions,
      resolver
    );
    if (dispatch_ids.length > 0) {
      resolved_symbols = dispatch_ids;
    }
  }

  // Step 3: Python-specific callable instance (__call__ method)
  if (
    resolved_symbols.length === 1 &&
    ref.location.file_path.endsWith(".py")
  ) {
    const call_method = resolve_callable_instance(
      resolved_symbols[0],
      context.definitions,
      context.types
    );
    if (call_method) {
      resolved_symbols = [call_method];
    }
  }

  return resolved_symbols;
}
