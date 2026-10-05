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
import type { ReceiverResolutionContext } from "./receiver_resolution";
import type { ValueSource } from "./value_source";

/**
 * Check if a resolved variable can be called via __call__ and return that method.
 *
 * @param resolved_symbol - The symbol resolved from the function call
 * @param held - What the binding holds, as the caller's own value-source walk
 *   already answered it. It types an instance no declaration does —
 *   `processor = make_processor()` — and the walk is not repeated here.
 * @returns The __call__ method SymbolId if the variable's type has one, undefined otherwise
 */
export function resolve_callable_instance(
  resolved_symbol: SymbolId,
  held: ValueSource | null,
  context: ReceiverResolutionContext
): SymbolId | undefined {
  const def = context.definitions.get(resolved_symbol);

  // A bare function name is called directly; only an instance held in a
  // variable or constant can dispatch through the __call__ protocol.
  if (!def || (def.kind !== "variable" && def.kind !== "constant")) {
    return undefined;
  }

  const type_id =
    context.types.get_symbol_type(resolved_symbol) ??
    (held?.kind === "instance_of" ? held.type_id : null);
  if (!type_id) {
    return undefined;
  }

  const call_method = context.types.get_type_member(type_id, "__call__" as SymbolName);
  if (!call_method) {
    return undefined;
  }

  return call_method;
}
