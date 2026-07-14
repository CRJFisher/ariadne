/**
 * Resolves bare function calls (no receiver) to their target definitions.
 *
 * A path-qualified call (`worker::create`) binds through its qualifier first,
 * honouring the author's path over a same-name local. A bare call resolves by
 * name, skips method/constructor definitions (they require a receiver), then
 * falls back to collection dispatch and the Python callable-instance protocol.
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
import { resolve_via_path_prefix_rust } from "./function_call.rust";

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

  const def = context.definitions.get(initial);
  if (!def) return ok(initial); // Trust unresolved symbols

  // Methods and constructors require receivers - can't be called as bare functions
  if (def.kind !== "method" && def.kind !== "constructor") {
    return ok(initial);
  }

  // Find an alternative by walking up from the class scope to where imports live.
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

  const alternative = resolver.resolve(class_scope.parent_id, ref.name);
  if (!alternative) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: class_scope.parent_id },
    });
  }

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
  // Path-qualified calls resolve via the qualifier first — the author wrote the
  // path, so honour it. This binds the terminal under its module/type rather
  // than letting a same-name local shadow capture it via the scope map. The
  // leaf self-guards and returns null for unqualified calls.
  const via_path = resolve_via_path_prefix_rust(ref, context, resolver);
  if (via_path) {
    return ok([via_path]);
  }

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

  // @language python
  // Step 3: Python-specific callable instance (__call__ method)
  if (
    resolved_symbols.length === 1 &&
    context.languages.get(ref.location.file_path) === "python"
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
