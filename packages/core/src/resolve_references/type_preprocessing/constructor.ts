/**
 * Constructor Bindings Extraction
 *
 * Extracts type names from constructor calls and maps them to their assignment targets.
 * Maps constructor assignment locations to their constructed type names (strings, not resolved SymbolIds).
 *
 * Resolution of type names to SymbolIds happens in the TypeRegistry using ResolutionRegistry.
 */

import type { SymbolReference } from "@ariadnejs/types";
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Result of constructor binding extraction.
 *
 * - `direct`: location → class name for direct constructors (`new User()`)
 * - `namespace_qualified`: location → namespace chain for qualified constructors (`new models.User()`)
 */
export interface ConstructorBindings {
  readonly direct: ReadonlyMap<LocationKey, SymbolName>;
  readonly namespace_qualified: ReadonlyMap<LocationKey, readonly SymbolName[]>;
}

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
 * @returns ConstructorBindings with simple and qualified maps
 *
 * @example
 * ```typescript
 * // Input: const user = new User();
 * // Output: simple = Map { "file.ts:1:6:1:10" => "User" }
 *
 * // Input: const user = new models.User(name);
 * // Output: qualified = Map { "file.ts:1:6:1:10" => ["models", "User"] }
 * ```
 */
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): ConstructorBindings {
  const direct = new Map<LocationKey, SymbolName>();
  const namespace_qualified = new Map<LocationKey, readonly SymbolName[]>();

  for (const ref of references) {
    if (ref.kind !== "constructor_call") continue;
    if (ref.construct_target === undefined) continue;

    const key = location_key(ref.construct_target);

    // property_chain = [namespace, class_name] — length > 1 means namespace-qualified
    if (ref.property_chain && ref.property_chain.length > 1) {
      // e.g., new models.User(name) → ["models", "User"]
      namespace_qualified.set(key, ref.property_chain);
    } else {
      // e.g., new User() → "User"
      direct.set(key, ref.name);
    }
  }

  return { direct, namespace_qualified };
}
