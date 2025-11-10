/**
 * Constructor Bindings Extraction
 *
 * Extracts type names from constructor calls and maps them to their assignment targets.
 * Maps constructor assignment locations to their constructed type names (strings, not resolved SymbolIds).
 *
 * Resolution of type names to SymbolIds happens in task 11.109 using ScopeResolver.
 */

import type { SymbolReference } from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Extract constructor bindings from references
 *
 * Extracts type names from constructor calls where:
 * - kind === "constructor_call"
 * - construct_target is defined
 *
 * Uses discriminated union pattern matching to identify constructor calls.
 *
 * @param references - Array of symbol references from semantic index
 * @returns Map from construct_target location to constructed type name (string)
 *
 * @example
 * ```typescript
 * // Input: const user = new User();
 * // Output: Map { "file.ts:1:6:1:10" => "User" }
 *
 * // Input: this.service = new ApiService();
 * // Output: Map { "file.ts:1:5:1:12" => "ApiService" }
 * ```
 */
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): ReadonlyMap<LocationKey, SymbolName> {
  const bindings = new Map<LocationKey, SymbolName>();

  for (const ref of references) {
    // Only process constructor calls using discriminated union
    // TypeScript automatically narrows the type in this block
    if (ref.kind === "constructor_call") {
      // ref.construct_target is guaranteed to exist (no undefined check needed)
      const target_location = ref.construct_target;
      const key = location_key(target_location);
      const type_name = ref.name;

      // Map the target location to the type name
      bindings.set(key, type_name);
    }
  }

  return bindings;
}
