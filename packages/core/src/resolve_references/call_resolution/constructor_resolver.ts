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
import type { TypeRegistry } from "../../project/type_registry";
import type { DefinitionRegistry } from "../../project/definition_registry";
import type { ResolutionRegistry } from "../../project/resolution_registry";

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

/**
 * Resolve a single constructor call reference.
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
 * @param call_ref - Constructor call reference from semantic index
 * @param definitions - Definition registry for class lookup
 * @param resolutions - Resolution registry with eager resolutions
 * @param _types - TypeRegistry (unused, kept for signature compatibility)
 * @returns Resolved constructor/class symbol_id or null if resolution fails
 */
export function resolve_single_constructor_call(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  _types: TypeRegistry
): SymbolId | null {
  // Step 1: Resolve class name using EAGER resolution
  // The call_ref.name contains the class name (e.g., "User" in new User())
  const class_symbol = resolutions.resolve(
    call_ref.scope_id,
    call_ref.name as SymbolName
  );

  if (!class_symbol) {
    // Class name not found in scope (undefined class or missing import)
    return null;
  }

  // Step 2: Verify it's actually a class and get constructor
  const class_def = find_class_definition(class_symbol, definitions);

  if (!class_def) {
    // Symbol is not a class (might be variable, function, etc.)
    return null;
  }

  // Step 3: Return constructor symbol if exists, otherwise class symbol
  // Classes may have explicit constructor methods
  const constructor_symbol = class_def.methods.find(
    (method) => method.name === "constructor"
  )?.symbol_id;

  return constructor_symbol || class_symbol;
}
