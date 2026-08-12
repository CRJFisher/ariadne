import {
  location_key,
  type IndirectReachability,
  type FilePath,
  type SymbolId,
  type SymbolReference,
  type CallableValueReference,
} from "@ariadnejs/types";
import { is_ok } from "@ariadnejs/types";
import {
  create_method_call_reference,
} from "../../index_single_file/references/factories";
import { resolve_method_call } from "./method_call";
import type { CallResolutionContext } from "./call_resolver";

/**
 * Resolve callable-value references — callables handed somewhere by name
 * rather than invoked — to indirect-reachability entries. A callable value is
 * never a call edge: the map produced here merges into the resolution result's
 * `indirect_reachability`, the channel entry-point detection already consumes
 * as reachability evidence only.
 */
export function resolve_callable_values(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  context: CallResolutionContext
): Map<SymbolId, IndirectReachability> {
  const reachable = new Map<SymbolId, IndirectReachability>();

  for (const references of file_references.values()) {
    for (const ref of references) {
      if (ref.kind !== "callable_value") continue;

      for (const target of resolve_callable_value(ref, context)) {
        const definition = context.definitions.get(target);
        if (
          definition?.kind !== "function" &&
          definition?.kind !== "method"
        ) {
          continue;
        }
        if (!reachable.has(target)) {
          reachable.set(target, {
            reason: { type: "function_reference", read_location: ref.location },
          });
        }
      }
    }
  }

  return reachable;
}

function resolve_callable_value(
  ref: CallableValueReference,
  context: CallResolutionContext
): SymbolId[] {
  // A named function expression's capture sits on the definition's own name
  // node, so the exact location resolves it without any name lookup.
  const at_location = context.definitions.get_symbol_at_location(
    location_key(ref.location)
  );
  if (at_location) {
    return [at_location];
  }

  if (ref.property_chain.length >= 2 && ref.receiver_location) {
    const method_result = resolve_method_call(
      create_method_call_reference(
        ref.name,
        ref.location,
        ref.scope_id,
        ref.receiver_location,
        ref.property_chain,
        false
      ),
      context.scopes,
      context.definitions,
      context.types,
      context.resolutions,
      context.imports,
      context.exports,
      context.languages,
      context.modules
    );
    return is_ok(method_result) ? method_result.value : [];
  }

  // A single-element chain that is not a definition's own name node carries no
  // receiver to bind. Resolving it by name would reach any function sharing
  // that name and silently mark it reachable.
  return [];
}
