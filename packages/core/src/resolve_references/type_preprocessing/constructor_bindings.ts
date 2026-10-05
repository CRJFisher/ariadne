/**
 * Extracts the constructed type's name chain of each constructor call, keyed by
 * the location of the variable it is assigned to. The chains stay as raw names;
 * resolution to SymbolIds happens later in the TypeRegistry, which is the only
 * stage with the cross-file scope to resolve them.
 */

import type { Location, SymbolReference } from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * The name chains a file's constructions type, keyed by the location of the
 * binding that stores each: `values` for a binding that holds the construction
 * itself, `elements` for one whose sequence literal holds it as an element.
 */
export interface ConstructorBindings {
  readonly values: ReadonlyMap<LocationKey, readonly SymbolName[]>;
  readonly elements: ReadonlyMap<LocationKey, readonly (readonly SymbolName[])[]>;
}

/**
 * A constructor call binds to the name chain at its call site — `["User"]` for
 * `new User()`, `["models", "User"]` for `new models.User()` — whether or not
 * that class has an explicit constructor. Calls with no assignment target
 * (standalone or returned) carry no `construct_target` and are skipped, since
 * there is no location to key.
 *
 * `const suites = [new Suite("root")]` stores Suites, and is not one: the
 * construction types the binding's element, so every element construction is
 * kept for the element channel and none types the container. A namespace call
 * (`[models.User(name)]`) is kept by its chain too: it types the element only if
 * the chain names a class. A plain call in the same literal that did not become
 * a construction (`[Suite(), make()]`) holds an element of a type no
 * construction names, so that literal types no element.
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
  const values = new Map<LocationKey, readonly SymbolName[]>();
  const elements = new Map<LocationKey, (readonly SymbolName[])[]>();
  const mixed_literals = new Set<LocationKey>();

  const add_element = (container: Location, chain: readonly SymbolName[]): void => {
    const key = location_key(container);
    const chains = elements.get(key);
    if (chains) {
      chains.push(chain);
    } else {
      elements.set(key, [chain]);
    }
  };

  for (const ref of references) {
    if (ref.kind === "function_call") {
      if (ref.potential_construct_element_of !== undefined) {
        mixed_literals.add(location_key(ref.potential_construct_element_of));
      }
      continue;
    }
    if (ref.kind === "method_call") {
      if (ref.potential_construct_element_of !== undefined) {
        add_element(ref.potential_construct_element_of, ref.property_chain);
      }
      continue;
    }
    if (ref.kind !== "constructor_call") continue;

    const chain =
      ref.property_chain && ref.property_chain.length > 1
        ? ref.property_chain
        : [ref.name];
    if (ref.construct_target !== undefined) {
      values.set(location_key(ref.construct_target), chain);
    } else if (ref.construct_element_of !== undefined) {
      add_element(ref.construct_element_of, chain);
    }
  }

  for (const key of mixed_literals) {
    elements.delete(key);
  }
  return { values, elements };
}
