/**
 * Member-assignment function collections
 *
 * Folds functions assigned to a holder's property across separate statements
 * (`app.method = function () {}`, `Fn.prototype.method = () => {}`) into a
 * FunctionCollection on the holder's definition, so `app.method()` and
 * `this.method()` resolve to the assigned function.
 */

import {
  type CollectionMember,
  type FunctionCollection,
  type Location,
  type SymbolId,
  type SymbolName,
  type VariableDefinition,
} from "@ariadnejs/types";
import type { FunctionBuilderState } from "./builder_state";

/**
 * Fold member-assignment functions into a holder's FunctionCollection, keeping
 * any members it already carries from an object-literal initializer. Assigned
 * members feed both `named_members` (property-name lookup) and
 * `stored_functions` (indirect-reachability tracking).
 */
function merge_collection_members(
  holder_id: SymbolId,
  holder_location: Location,
  existing: FunctionCollection | undefined,
  members: readonly CollectionMember[]
): FunctionCollection {
  const stored_members = members
    .map((member) => member.symbol_id)
    .filter((symbol_id): symbol_id is SymbolId => symbol_id !== undefined);

  return {
    collection_id: holder_id,
    collection_type: existing?.collection_type ?? "Object",
    location: existing?.location ?? holder_location,
    stored_functions: [...(existing?.stored_functions ?? []), ...stored_members],
    stored_references: existing?.stored_references,
    named_members: [...(existing?.named_members ?? []), ...members],
  };
}

/**
 * Attach accumulated member-assignment functions to their holder definition (a
 * variable/constant object or a constructor function), merging with any
 * collection the holder already carries from an object-literal initializer.
 * Mutates the passed `variables` and `functions` builder maps in place.
 */
export function attach_collection_members(
  pending: ReadonlyMap<SymbolName, CollectionMember[]>,
  variables: Map<SymbolId, VariableDefinition>,
  functions: Map<SymbolId, FunctionBuilderState>
): void {
  for (const [holder_name, members] of pending) {
    const variable = find_by_name(
      variables.values(),
      (v) => v.name === holder_name
    );
    if (variable) {
      variables.set(variable.symbol_id, {
        ...variable,
        function_collection: merge_collection_members(
          variable.symbol_id,
          variable.location,
          variable.function_collection,
          members
        ),
      });
      continue;
    }

    const fn_state = find_by_name(
      functions.values(),
      (state) => state.base.name === holder_name
    );
    if (fn_state && fn_state.base.symbol_id && fn_state.base.location) {
      fn_state.base = {
        ...fn_state.base,
        function_collection: merge_collection_members(
          fn_state.base.symbol_id,
          fn_state.base.location,
          fn_state.base.function_collection,
          members
        ),
      };
    }
  }
}

function find_by_name<T>(
  entries: IterableIterator<T>,
  matches: (entry: T) => boolean
): T | undefined {
  for (const entry of entries) {
    if (matches(entry)) {
      return entry;
    }
  }
  return undefined;
}
