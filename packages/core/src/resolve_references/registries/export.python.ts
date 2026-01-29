/**
 * Python-specific Export Handling
 *
 * Handles Python's semantics where module-level variable reassignment
 * creates multiple definitions with the same name. Python allows:
 * ```python
 * x = 1  # Definition 1
 * x = 2  # Definition 2 (reassignment)
 * ```
 * Both are captured as definitions, but only the last should be exported.
 */

import type { SymbolId } from "@ariadnejs/types";

/**
 * Extract the start line number from a SymbolId.
 * SymbolId format: "kind:file:start_line:start_col:end_line:end_col:name"
 */
export function extract_line_from_symbol_id(symbol_id: SymbolId): number {
  const parts = symbol_id.split(":");
  // parts[2] is start_line
  return parseInt(parts[2], 10);
}

/**
 * Determine if the current definition should replace an existing one
 * based on Python's variable reassignment semantics.
 *
 * In Python, when a variable is reassigned at module level, both assignments
 * create definitions. The last assignment "wins" for export purposes.
 *
 * @param existing_symbol_id - SymbolId of the existing definition
 * @param current_start_line - Start line of the current definition
 * @returns true if current definition should replace existing
 */
export function should_replace_python_variable(
  existing_symbol_id: SymbolId,
  current_start_line: number
): boolean {
  const existing_line = extract_line_from_symbol_id(existing_symbol_id);
  return current_start_line > existing_line;
}

/**
 * Check if a SymbolId represents a variable or constant.
 */
export function is_variable_or_constant_symbol(symbol_id: SymbolId): boolean {
  return (
    symbol_id.includes("variable:") || symbol_id.includes("constant:")
  );
}
