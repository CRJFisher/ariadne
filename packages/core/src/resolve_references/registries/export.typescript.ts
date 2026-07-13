import type { SymbolId, ExportableDefinition } from "@ariadnejs/types";

/**
 * A TS/JS arrow function assigned to a const (`export const f = () => {}`)
 * produces both a function and a variable/constant definition under one name.
 * The variable is the exported binding, so a same-name function/binding pair is
 * collapsed onto the binding rather than reported as a duplicate export.
 */

/**
 * Decide which side of a same-name function/binding pair is the exported one.
 * Returns `"not_applicable"` when the pair is not the arrow-function shape.
 */
export function resolve_arrow_function_export(
  existing_symbol_id: SymbolId,
  incoming_kind: ExportableDefinition["kind"]
): "replace_existing" | "keep_existing" | "not_applicable" {
  const incoming_is_binding =
    incoming_kind === "variable" || incoming_kind === "constant";

  if (existing_symbol_id.includes("function:") && incoming_is_binding) {
    return "replace_existing";
  }

  if (
    incoming_kind === "function" &&
    (existing_symbol_id.includes("variable:") ||
      existing_symbol_id.includes("constant:"))
  ) {
    return "keep_existing";
  }

  return "not_applicable";
}
