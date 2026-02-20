/**
 * Python Callable Instance Resolution
 *
 * When `instance()` is called on a variable of a class type that has
 * a `__call__` method, resolve to that method.
 *
 * This handles the Python callable class pattern:
 * ```python
 * class Processor:
 *     def __call__(self, data):
 *         return self.process(data)
 *
 * processor = Processor()
 * processor(data)  # Should resolve to Processor.__call__
 * ```
 */

import type { SymbolId, SymbolName } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { TypeRegistry } from "../registries/type";

/**
 * Check if a resolved variable can be called via __call__ and return that method.
 *
 * @param resolved_symbol - The symbol resolved from the function call
 * @param definitions - Registry to look up definition kind
 * @param types - Registry to look up type and member information
 * @returns The __call__ method SymbolId if the variable's type has one, undefined otherwise
 */
export function resolve_callable_instance(
  resolved_symbol: SymbolId,
  definitions: DefinitionRegistry,
  types: TypeRegistry
): SymbolId | undefined {
  const def = definitions.get(resolved_symbol);

  // Only check variables and constants - functions should be called directly
  if (!def || (def.kind !== "variable" && def.kind !== "constant")) {
    return undefined;
  }

  // Get the type of the variable
  const type_id = types.get_symbol_type(resolved_symbol);
  if (!type_id) {
    return undefined;
  }

  // Check if the type has a __call__ method
  const call_method = types.get_type_member(type_id, "__call__" as SymbolName);
  if (!call_method) {
    return undefined;
  }

  return call_method;
}
