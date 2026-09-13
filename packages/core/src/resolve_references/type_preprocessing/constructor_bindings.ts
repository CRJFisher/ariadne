/**
 * Extracts the constructed type's name chain of each constructor call, keyed by
 * the location of the variable it is assigned to. The chains stay as raw names;
 * resolution to SymbolIds happens later in the TypeRegistry, which is the only
 * stage with the cross-file scope to resolve them.
 */

import type { SymbolReference } from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * A constructor call binds to the name chain at its call site — `["User"]` for
 * `new User()`, `["models", "User"]` for `new models.User()` — whether or not
 * that class has an explicit constructor. Calls with no assignment target
 * (standalone or returned) carry no `construct_target` and are skipped, since
 * there is no location to key.
 *
 * The input must be the file's references as the ReferenceRegistry holds them
 * after preprocessing, not the raw index's. `new User()` reaches the index as a
 * constructor call already, but a Python construction is syntactically a plain
 * call: `preprocess_references.python.ts` mints the constructor call only once
 * the callee resolves to a class, so passing the index's own references yields
 * no Python bindings at all.
 */
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): ReadonlyMap<LocationKey, readonly SymbolName[]> {
  const bindings = new Map<LocationKey, readonly SymbolName[]>();

  for (const ref of references) {
    if (ref.kind !== "constructor_call") continue;
    if (ref.construct_target === undefined) continue;

    const chain =
      ref.property_chain && ref.property_chain.length > 1
        ? ref.property_chain
        : [ref.name];
    bindings.set(location_key(ref.construct_target), chain);
  }

  return bindings;
}
