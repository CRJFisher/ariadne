/**
 * Extracts the constructed type name of each constructor call, keyed by the
 * location of the variable it is assigned to. The extracted names stay as raw
 * strings; resolution to SymbolIds happens later in the TypeRegistry, which is
 * the only stage with the cross-file scope to resolve them.
 */

import type { SymbolReference } from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * - `direct`: assignment location → class name for direct constructors (`new User()`)
 * - `namespace_qualified`: assignment location → namespace chain for qualified
 *   constructors (`new models.User()`)
 */
export interface ConstructorBindings {
  readonly direct: ReadonlyMap<LocationKey, SymbolName>;
  readonly namespace_qualified: ReadonlyMap<LocationKey, readonly SymbolName[]>;
}

/**
 * A constructor call binds to the name at its call site, whether or not that
 * class has an explicit constructor. Calls with no assignment target (standalone
 * or returned) carry no `construct_target` and are skipped, since there is no
 * location to key.
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
): ConstructorBindings {
  const direct = new Map<LocationKey, SymbolName>();
  const namespace_qualified = new Map<LocationKey, readonly SymbolName[]>();

  for (const ref of references) {
    if (ref.kind !== "constructor_call") continue;
    if (ref.construct_target === undefined) continue;

    const key = location_key(ref.construct_target);

    // A property_chain longer than one names a namespace: [namespace, class_name].
    if (ref.property_chain && ref.property_chain.length > 1) {
      namespace_qualified.set(key, ref.property_chain);
    } else {
      direct.set(key, ref.name);
    }
  }

  return { direct, namespace_qualified };
}
