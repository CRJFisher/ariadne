import type { SymbolId } from "@ariadnejs/types";

/**
 * Python module-level reassignment (`x = 1; x = 2`) produces a separate
 * definition per assignment, all sharing one name. For export purposes only
 * the last assignment is visible, so duplicates are resolved by source order.
 */

/**
 * SymbolId format is `kind:file:start_line:start_col:end_line:end_col:name`,
 * so the start line is the third colon-delimited field.
 */
function extract_line_from_symbol_id(symbol_id: SymbolId): number {
  return parseInt(symbol_id.split(":")[2], 10);
}

/**
 * Whether a later variable assignment should supersede an earlier one sharing
 * the same name — the last assignment in source order is the exported one.
 */
export function should_replace_python_variable(
  existing_symbol_id: SymbolId,
  current_start_line: number
): boolean {
  return current_start_line > extract_line_from_symbol_id(existing_symbol_id);
}

export function is_variable_or_constant_symbol(symbol_id: SymbolId): boolean {
  return symbol_id.includes("variable:") || symbol_id.includes("constant:");
}
