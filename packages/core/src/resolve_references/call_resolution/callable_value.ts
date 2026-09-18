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
import { record_indirect_reachability } from "../indirect_reachability";
import { record_dispatch, type SubtypeDispatchFiles } from "./subtype_dispatch";
import { resolve_method_call } from "./method_call";
import type { DispatchedThrough } from "./method_lookup";
import type { CallResolutionContext } from "./call_resolver";

/** The indirect reachability callable values produce, and the subtype closures their member reads enumerated. */
export interface CallableValueResolution {
  readonly reachable: Map<SymbolId, IndirectReachability>;
  readonly subtype_dispatch_files: SubtypeDispatchFiles;
  readonly undeclared_interface_files: SubtypeDispatchFiles;
}

/**
 * Resolve callable-value references — callables handed somewhere by name
 * rather than invoked — to indirect-reachability entries. A callable value is
 * never a call edge: the map produced here merges into the resolution result's
 * `indirect_reachability`, the channel entry-point detection already consumes
 * as reachability evidence only.
 *
 * A member read (`handler.process` handed by value) dispatches like a method
 * call, so what it dispatched through is recorded against the reading file for
 * the same re-resolution a call gets: the subtype closure it enumerated, and an
 * interface no class declares, which is what offers that interface to the next
 * conforming class to arrive.
 */
export function resolve_callable_values(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  context: CallResolutionContext
): CallableValueResolution {
  const reachable = new Map<SymbolId, IndirectReachability>();
  const subtype_dispatch_files: SubtypeDispatchFiles = new Map();
  const undeclared_interface_files: SubtypeDispatchFiles = new Map();

  for (const references of file_references.values()) {
    for (const ref of references) {
      if (ref.kind !== "callable_value") continue;

      const { targets, ...dispatched } = resolve_callable_value(ref, context);
      record_dispatch(
        subtype_dispatch_files,
        undeclared_interface_files,
        dispatched,
        ref.location.file_path
      );
      for (const target of targets) {
        const definition = context.definitions.get(target);
        if (
          definition?.kind !== "function" &&
          definition?.kind !== "method"
        ) {
          continue;
        }
        record_indirect_reachability(reachable, target, {
          reason: { type: "function_reference", read_location: ref.location },
        });
      }
    }
  }

  return { reachable, subtype_dispatch_files, undeclared_interface_files };
}

function resolve_callable_value(
  ref: CallableValueReference,
  context: CallResolutionContext
): { readonly targets: SymbolId[] } & DispatchedThrough {
  // A named function expression's capture sits on the definition's own name
  // node, so the exact location resolves it without any name lookup.
  const at_location = context.definitions.get_symbol_at_location(
    location_key(ref.location)
  );
  if (at_location) {
    return { targets: [at_location], subtype_closure_of: null, undeclared_interface: null };
  }

  if (ref.property_chain.length >= 2 && ref.receiver_location) {
    const { targets, ...dispatched } = resolve_method_call(
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
    return { targets: is_ok(targets) ? targets.value : [], ...dispatched };
  }

  // A single-element chain that is not a definition's own name node carries no
  // receiver to bind. Resolving it by name would reach any function sharing
  // that name and silently mark it reachable.
  return { targets: [], subtype_closure_of: null, undeclared_interface: null };
}
