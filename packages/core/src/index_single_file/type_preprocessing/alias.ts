/**
 * Type Alias Metadata Extraction
 *
 * Extracts raw type expressions from type aliases (NOT resolved to SymbolIds).
 * Maps type alias SymbolIds to their type_expression strings.
 *
 * Resolution of type expressions to SymbolIds happens in task 11.109.3 using ScopeResolver.
 */

import type { TypeAliasDefinition, SymbolId, SymbolName } from "@ariadnejs/types";

/**
 * Extract type alias metadata from type definitions
 *
 * Extracts type_expression strings from TypeAliasDefinition objects where:
 * - type_expression is defined
 *
 * @param types - Map of type alias definitions from semantic index
 * @returns Map from type alias SymbolId to type_expression string (NOT resolved)
 *
 * @example
 * ```typescript
 * // Input: type UserId = string;
 * // Output: Map { "type:file.ts:1:5:1:11:UserId" => "string" }
 *
 * // Input: type Result<T> = T | Error;
 * // Output: Map { "type:file.ts:1:5:1:11:Result" => "T | Error" }
 * ```
 *
 * @remarks
 * This function extracts raw type expression strings. Resolution to SymbolIds
 * happens using ScopeResolver for scope-aware type resolution.
 */
export function extract_type_alias_metadata(
  types: ReadonlyMap<SymbolId, TypeAliasDefinition>
): ReadonlyMap<SymbolId, SymbolName> {
  const metadata = new Map<SymbolId, SymbolName>();

  for (const [type_symbol_id, type_def] of types) {
    // Only extract if type_expression is defined
    if (type_def.type_expression) {
      metadata.set(type_symbol_id, type_def.type_expression);
    }
  }

  return metadata;
}
