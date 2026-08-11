import type { FilePath, SymbolId } from "@ariadnejs/types";

/**
 * Python module-level reassignment (`x = 1; x = 2`) produces a separate
 * definition per assignment, all sharing one name. For export purposes only
 * the last assignment is visible, so duplicates are resolved by source order.
 */

/**
 * Check if a file is a Python file by extension.
 *
 * @param file_path - File path to check
 * @returns true if file has .py or .pyw extension
 */
export function is_python_file(file_path: FilePath): boolean {
  return file_path.endsWith(".py") || file_path.endsWith(".pyw");
}

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

/**
 * The location fields of a SymbolId (`start_line:start_col:end_line:end_col`),
 * which identify the syntactic site the symbol was built from.
 */
function location_of(symbol_id: SymbolId): string {
  return symbol_id.split(":").slice(2, 6).join(":");
}

/**
 * Whether two same-named module-level Python definitions are a legal
 * redefinition rather than one symbol captured twice.
 *
 * Python rebinds a module-level name freely: an `@overload` group declares the
 * same function several times before its implementation, and a platform- or
 * version-guarded definition redeclares one. The last declaration in source
 * order is what the module exports.
 *
 * Two definitions at the same location are not a redefinition — that is the
 * indexing bug the duplicate-export error exists to surface, so it still
 * throws.
 */
export function is_python_redefinition(
  existing_symbol_id: SymbolId,
  incoming_symbol_id: SymbolId
): boolean {
  return location_of(existing_symbol_id) !== location_of(incoming_symbol_id);
}
