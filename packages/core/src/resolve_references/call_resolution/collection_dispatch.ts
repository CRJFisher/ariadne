/**
 * Resolves a call whose target was retrieved from a collection of functions to
 * every function the collection holds. A lookup like `const h = CONFIG.get(k)`
 * loses the specific element statically, so a later `h(x)` is resolved to the
 * union of all handlers stored in `CONFIG`:
 *
 * ```typescript
 * const CONFIG = new Map([["class", handler1], ["fn", handler2]]);
 * const handler = CONFIG.get(type); // handler.collection_source = "CONFIG"
 * handler(capture);  // ← resolves to [handler1, handler2]
 * ```
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
  SymbolReference,
  MethodCallReference,
  KeyedCollectionEntry,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolution_registry";

/**
 * Resolve the callable at `key` within a keyed object-literal collection: an inline
 * function value directly, or an identifier value resolved in `scope_id`. Returns
 * undefined when the key is absent or names a nested object (not itself callable).
 */
export function resolve_keyed_member(
  entries: readonly KeyedCollectionEntry[],
  key: SymbolName,
  scope_id: ScopeId,
  resolutions: ResolutionRegistry
): SymbolId | undefined {
  const entry = entries.find((e) => e.key === key);
  if (!entry) return undefined;
  if (entry.function_id) return entry.function_id;
  if (entry.reference) return resolutions.resolve(scope_id, entry.reference) ?? undefined;
  return undefined;
}


/**
 * @returns Resolved function symbol_ids on success, or a `ResolutionFailure`
 *          identifying why no collection-stored functions could be reached.
 */
export function resolve_collection_dispatch(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  let target_name: SymbolName | undefined;
  const scope_id = call_ref.scope_id;

  if (call_ref.kind === "function_call") {
    target_name = call_ref.name;
  } else if (call_ref.kind === "method_call") {
    // The collection element is held by the receiver, the second-to-last chain
    // element: `handler.process()` → chain ["handler", "process"] → "handler".
    const method_ref = call_ref as MethodCallReference;
    if (method_ref.property_chain && method_ref.property_chain.length >= 2) {
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
    // Resolved to a symbol_id with no registered definition (e.g. an unresolved
    // import target), so the target cannot be inspected for a collection_source.
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: {
        resolved_receiver_type: target_id,
        last_known_scope: scope_id,
      },
    });
  }

  // collection_source is carried only on variable/constant definitions.
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

  // collection_source is a bare name, resolved from where the target was defined.
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

  // A static object-property alias (`var A = Ns.A`) names one member by key, so it
  // dispatches to exactly that member — never the union of everything in `Ns`.
  if (target_def.collection_source_key) {
    return resolve_keyed_alias(
      collection_id,
      target_def.collection_source_key,
      call_ref,
      definitions,
      resolutions
    );
  }

  return get_collection_functions(collection_id, definitions, resolutions);
}

/**
 * Resolve a static object-property alias call to the single keyed member it names.
 * `alias_key` addresses the aliased value in the collection's keyed members; a method
 * call then addresses a function one property deeper (inside the aliased nested
 * object), a direct call targets the aliased value itself. A miss returns a failure
 * rather than falling back to the union.
 */
function resolve_keyed_alias(
  collection_id: SymbolId,
  alias_key: SymbolName,
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  const collection = definitions.get_function_collection(collection_id);
  const collection_def = definitions.get(collection_id);
  const entry = collection?.keyed_members?.find((m) => m.key === alias_key);
  if (!collection || !collection_def || !entry) {
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: collection_id },
    });
  }

  const scope_id = collection_def.defining_scope_id;
  const target =
    call_ref.kind === "method_call"
      ? entry.nested
        ? resolve_keyed_member(entry.nested, call_ref.name, scope_id, resolutions)
        : undefined
      : entry.function_id ??
        (entry.reference ? resolutions.resolve(scope_id, entry.reference) ?? undefined : undefined);

  if (!target) {
    return err({
      stage: "collection_dispatch",
      reason: "collection_dispatch_miss",
      partial_info: { resolved_receiver_type: collection_id },
    });
  }
  return ok([target]);
}

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

  // stored_references are unresolved identifiers stored in the collection;
  // resolve each from the collection's defining scope.
  if (collection.stored_references && collection.stored_references.length > 0) {
    const def = definitions.get(variable_id);
    if (def) {
      for (const ref_name of collection.stored_references) {
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
