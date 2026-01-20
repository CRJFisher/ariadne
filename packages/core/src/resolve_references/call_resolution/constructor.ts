/**
 * Constructor Call Resolution
 *
 * Resolves constructor calls by:
 * 1. Resolving the class name (EAGER: from pre-computed resolutions)
 * 2. Looking up the class definition
 * 3. Returning explicit constructor or class symbol
 *
 * Integration points:
 * - Uses ResolutionRegistry for EAGER O(1) class name resolution
 * - Uses DefinitionRegistry to look up class definitions
 * - Uses TypeRegistry for namespace member lookups
 */

import type {
  SymbolId,
  SymbolName,
  SymbolReference,
  ClassDefinition,
} from "@ariadnejs/types";
import type { TypeRegistry } from "../registries/type";
import type { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolve_references";

/**
 * Resolve a constructor call to zero, one, or more symbols
 *
 * EAGER approach: Uses pre-computed resolutions from ResolutionRegistry.
 *
 * Steps:
 * 1. Resolve class name using EAGER resolution
 * 2. Verify it's a class definition
 * 3. Return constructor symbol if exists, otherwise class symbol
 *
 * Note: Namespace member constructor calls (e.g., new utils.Helper())
 * are not yet supported in eager resolution. This is a rare case that
 * can be added as a future enhancement.
 *
 * Returns:
 * - []: Resolution failed (no class found or not a class)
 * - [symbol]: Concrete constructor call (new User())
 *
 * Multi-candidate logic can be added in the future for interface method resolution
 * and collection dispatch scenarios.
 *
 * @param call_ref - Constructor call reference from semantic index
 * @param definitions - Definition registry for class lookup
 * @param resolutions - Resolution registry with eager resolutions
 * @param _types - TypeRegistry (unused, kept for signature compatibility)
 * @returns Array of resolved constructor/class symbol_ids (empty if resolution fails)
 */
export function resolve_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  _types: TypeRegistry
): SymbolId[] {
  // Step 1: Resolve class name using EAGER resolution
  // The call_ref.name contains the class name (e.g., "User" in new User())
  const class_symbol = resolutions.resolve(
    call_ref.scope_id,
    call_ref.name as SymbolName
  );

  if (!class_symbol) {
    // Class name not found in scope (undefined class or missing import)
    return [];
  }

  // Step 2: Verify it's actually a class and get constructor
  const class_def = find_class_definition(class_symbol, definitions);

  if (!class_def) {
    // Symbol is not a class (might be variable, function, etc.)
    return [];
  }

  // Step 3: Return constructor symbol if exists, otherwise class symbol
  // Constructors are stored in class_def.constructor array, not methods
  const constructor_symbol = class_def.constructor?.[0]?.symbol_id;

  return [constructor_symbol || class_symbol];
}


/**
 * Helper: Find class definition from DefinitionRegistry.
 *
 * @param class_symbol - Class symbol ID
 * @param definitions - Definition registry
 * @returns ClassDefinition or null if not found or not a class
 */
function find_class_definition(
  class_symbol: SymbolId,
  definitions: DefinitionRegistry
): ClassDefinition | null {
  const def = definitions.get(class_symbol);

  if (!def || def.kind !== "class") {
    return null;
  }

  return def as ClassDefinition;
}
