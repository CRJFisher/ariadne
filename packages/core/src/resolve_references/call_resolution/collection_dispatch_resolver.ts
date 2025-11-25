/**
 * Collection Dispatch Resolution (Task 11.156.3)
 *
 * Resolves function calls through collection access patterns by:
 * 1. Detecting when a collection (Map/Array/Object) is accessed
 * 2. Detecting when the result is immediately invoked
 * 3. Resolving to ALL functions stored in the collection
 *
 * Pattern detected (Indirect invocation):
 * ```typescript
 * const CONFIG = new Map([["class", handler1], ["fn", handler2]]);
 * const handler = CONFIG.get(type); // handler.derived_from = "CONFIG"
 * handler(capture);  // ← Resolves to [handler1, handler2]
 * ```
 */

import type {
  SymbolId,
  SymbolReference,
  MethodCallReference,
  FunctionCallReference,
  VariableDefinition,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";


/**
 * Resolve a collection dispatch call to all stored functions.
 *
 * Steps:
 * 1. Identify the variable being called (function call) or the receiver (method call)
 * 2. Resolve that variable to a definition
 * 3. Check if the variable is derived from a collection (derived_from metadata)
 * 4. If so, resolve the collection variable
 * 5. Return all functions from the collection
 *
 * @param call_ref - Call reference from semantic index
 * @param definitions - Definition registry with function collections
 * @param resolutions - Resolution registry for symbol lookup
 * @returns Array of resolved function symbol_ids
 */
export function resolve_collection_dispatch(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // 1. Identify the target variable name
  let target_name: string | undefined;
  let scope_id = call_ref.scope_id;

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
    return [];
  }

  // 2. Resolve target variable
  const target_id = resolutions.resolve(scope_id, target_name as any);
  if (!target_id) {
    return [];
  }

  const target_def = definitions.get(target_id);
  if (!target_def) {
    return [];
  }

  // 3. Check derived_from
  // Only variables/constants have derived_from
  if (
    (target_def.kind !== "variable" && target_def.kind !== "constant") ||
    !target_def.derived_from
  ) {
    return [];
  }

  // 4. Resolve collection variable
  // derived_from is a name, resolve it in the target's defining scope
  const collection_id = resolutions.resolve(
    target_def.defining_scope_id,
    target_def.derived_from
  );

  if (!collection_id) {
    return [];
  }

  // 5. Get functions from collection
  return get_collection_functions(collection_id, definitions, resolutions);
}

/**
 * Get all functions from a collection variable.
 *
 * @param variable_id - SymbolId of the collection variable
 * @param definitions - Definition registry
 * @param resolutions - Resolution registry
 * @returns Array of function SymbolIds stored in the collection
 */
function get_collection_functions(
  variable_id: SymbolId,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  const collection = definitions.get_function_collection(variable_id);
  if (!collection) {
    return [];
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

  return functions;
}
