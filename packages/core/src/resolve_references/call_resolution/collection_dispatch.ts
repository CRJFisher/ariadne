/**
 * Collection Dispatch Resolution
 *
 * Resolves function calls through collection access patterns by:
 * 1. Detecting when a collection (Map/Array/Object) is accessed
 * 2. Detecting when the result is immediately invoked
 * 3. Resolving to ALL functions stored in the collection
 *
 * Pattern detected (Indirect invocation):
 * ```typescript
 * const CONFIG = new Map([["class", handler1], ["fn", handler2]]);
 * const handler = CONFIG.get(type); // handler.collection_source = "CONFIG"
 * handler(capture);  // ← Resolves to [handler1, handler2]
 * ```
 */

import type {
  SymbolId,
  SymbolName,
  SymbolReference,
  MethodCallReference,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolve_references";


/**
 * Resolve a collection dispatch call to all stored functions.
 *
 * Steps:
 * 1. Identify the variable being called (function call) or the receiver (method call)
 * 2. Resolve that variable to a definition
 * 3. Check if the variable was looked up from a collection (collection_source metadata)
 * 4. If so, resolve the collection variable
 * 5. Return all functions from the collection
 *
 * @returns Resolved function symbol_ids on success, or a `ResolutionFailure`
 *          identifying why no collection-stored functions could be reached.
 */
export function resolve_collection_dispatch(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  // 1. Identify the target variable name
  let target_name: SymbolName | undefined;
  const scope_id = call_ref.scope_id;

  if (call_ref.kind === "function_call") {
    // For fn(...), target is "fn"
    target_name = call_ref.name;
  } else if (call_ref.kind === "method_call") {
    // For obj.method(...), target is "obj" (receiver)
    // We need to extract receiver name from property_chain
    const method_ref = call_ref as MethodCallReference;
    if (method_ref.property_chain && method_ref.property_chain.length >= 2) {
      // Chain: ["obj", "method"] -> receiver is "obj"
      // Chain: ["api", "users", "list"] -> receiver is "users"? No, usually we resolve the base "api"
      // But here we want the variable that holds the collection item.
      // If `const handler = config.get(...)`, handler is a variable.
      // So we look for the variable name.
      // In `handler.process(...)`, chain is `["handler", "process"]`.
      target_name = method_ref.property_chain[method_ref.property_chain.length - 2];
    }
  }

  if (!target_name) {
    return err({
      stage: "collection_dispatch",
      reason: "dynamic_dispatch",
      partial_info: { last_known_scope: scope_id },
    });
  }

  // 2. Resolve target variable
  const target_id = resolutions.resolve(scope_id, target_name);
  if (!target_id) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: scope_id },
    });
  }

  const target_def = definitions.get(target_id);
  if (!target_def) {
    // Name resolved to a symbol_id, but no definition is registered for it
    // (e.g. unresolved import target). Surface as a collection dispatch miss
    // since we cannot inspect the target for a collection_source.
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: {
        resolved_receiver_type: target_id,
        last_known_scope: scope_id,
      },
    });
  }

  // 3. Check collection_source
  // Only variables/constants have collection_source
  if (
    (target_def.kind !== "variable" && target_def.kind !== "constant") ||
    !target_def.collection_source
  ) {
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: target_id },
    });
  }

  // 4. Resolve collection variable
  // collection_source is a name, resolve it in the target's defining scope
  const collection_id = resolutions.resolve(
    target_def.defining_scope_id,
    target_def.collection_source
  );

  if (!collection_id) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: target_def.defining_scope_id },
    });
  }

  // 5. Get functions from collection
  return get_collection_functions(collection_id, definitions, resolutions);
}

/**
 * Get all functions from a collection variable.
 */
function get_collection_functions(
  variable_id: SymbolId,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  const collection = definitions.get_function_collection(variable_id);
  if (!collection) {
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: variable_id },
    });
  }

  const functions = Array.from(collection.stored_functions);

  // Resolve stored references (e.g. identifiers in the collection)
  if (collection.stored_references && collection.stored_references.length > 0) {
    const def = definitions.get(variable_id);
    if (def) {
      for (const ref_name of collection.stored_references) {
        // Resolve in the scope where the collection variable is defined
        const resolved_id = resolutions.resolve(def.defining_scope_id, ref_name);
        if (resolved_id) {
          functions.push(resolved_id);
        }
      }
    }
  }

  if (functions.length === 0) {
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: variable_id },
    });
  }

  return ok(functions);
}
