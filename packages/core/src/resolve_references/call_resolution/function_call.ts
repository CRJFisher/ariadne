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
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, is_ok, ok } from "@ariadnejs/types";
import type { CallResolutionContext } from "./call_resolver";
import type { ResolutionRegistry } from "../resolve_references";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_callable_instance } from "./callable_instance.python";

/**
 * Find alternative resolution by skipping method/constructor definitions.
 *
 * When a function_call resolves to a method (which requires a receiver),
 * walk up the scope tree to find an import or function with the same name.
 */
function find_function_resolution(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): Result<SymbolId, ResolutionFailure> {
  const initial = resolver.resolve(ref.scope_id, ref.name);
  if (!initial) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: ref.scope_id },
    });
  }

  // Check if resolution is valid for a function call
  const def = context.definitions.get(initial);
  if (!def) return ok(initial); // Trust unresolved symbols

  // Methods and constructors require receivers - can't be called as bare functions
  if (def.kind !== "method" && def.kind !== "constructor") {
    return ok(initial); // Valid: function, variable, import
  }

  // Resolved to method/constructor - this can't be the target of a bare function call
  // Find alternative by walking up from the class scope
  const method_body_scope = def.body_scope_id;
  if (!method_body_scope) {
    return err({
      stage: "name_resolution",
      reason: "definition_has_no_body_scope",
      partial_info: { last_known_scope: ref.scope_id },
    });
  }

  const body_scope = context.scopes.get_scope(method_body_scope);
  if (!body_scope?.parent_id) {
    return err({
      stage: "name_resolution",
      reason: "definition_has_no_body_scope",
      partial_info: {
        resolved_receiver_type: initial,
        last_known_scope: method_body_scope,
      },
    });
  }

  // Class scope's parent should be module scope with imports
  const class_scope = context.scopes.get_scope(body_scope.parent_id);
  if (!class_scope?.parent_id) {
    return err({
      stage: "name_resolution",
      reason: "no_parent_class",
      partial_info: {
        resolved_receiver_type: initial,
        last_known_scope: body_scope.parent_id,
      },
    });
  }

  // Try resolving from module scope (where imports live)
  const alternative = resolver.resolve(class_scope.parent_id, ref.name);
  if (!alternative) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: class_scope.parent_id },
    });
  }

  // Verify the alternative is valid for a function call
  const alt_def = context.definitions.get(alternative);
  if (!alt_def) return ok(alternative);

  if (alt_def.kind === "method" || alt_def.kind === "constructor") {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: class_scope.parent_id },
    });
  }

  return ok(alternative);
}

/**
 * Resolve a function call to zero, one, or more symbols.
 *
 * Handles bare function calls (no receiver):
 * 1. Resolve the name, skipping method/constructor definitions
 * 2. Fall back to collection dispatch if unresolved or collection-sourced
 * 3. Fall back to Python callable instance (__call__ method)
 *
 * @returns Resolved symbol_ids on success, or a `ResolutionFailure` describing
 *          why no valid resolution could be produced.
 */
export function resolve_function_call(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  // Step 1: Resolve function name
  const name_result = find_function_resolution(ref, context, resolver);

  let resolved_symbols: SymbolId[] = [];
  if (is_ok(name_result)) {
    resolved_symbols = [name_result.value];
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
    const dispatch_result = resolve_collection_dispatch(
      ref,
      context.definitions,
      resolver
    );
    if (is_ok(dispatch_result) && dispatch_result.value.length > 0) {
      resolved_symbols = dispatch_result.value;
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

  if (resolved_symbols.length === 0) {
    // Prefer the original name-resolution failure (most specific). If name
    // resolution succeeded but downstream dispatch produced nothing, the
    // failure is in collection dispatch, not name resolution.
    return is_ok(name_result)
      ? err({
          stage: "collection_dispatch",
          reason: "collection_dispatch_miss",
          partial_info: {
            resolved_receiver_type: name_result.value,
            last_known_scope: ref.scope_id,
          },
        })
      : name_result;
  }

  return ok(resolved_symbols);
}
