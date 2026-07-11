/**
 * Extracts the raw type expression of each type alias, keyed by the alias's
 * SymbolId. The expressions stay as verbatim source strings (`"T | Error"`,
 * `"User"`); resolution to SymbolIds happens later in the TypeRegistry, which
 * is the only stage with the cross-file scope to resolve them.
 */

import type { TypeAliasDefinition, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Aliases whose `type_expression` is undefined — a trait associated type
 * declaration with no value (`type Item;`) — carry no expression to extract
 * and are skipped, so they never appear in the result.
 */
export function extract_type_alias_metadata(
  types: ReadonlyMap<SymbolId, TypeAliasDefinition>
): ReadonlyMap<SymbolId, SymbolName> {
  const metadata = new Map<SymbolId, SymbolName>();

  for (const [type_symbol_id, type_def] of types) {
    if (type_def.type_expression) {
      metadata.set(type_symbol_id, type_def.type_expression);
    }
  }

  return metadata;
}
