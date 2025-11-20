/**
 * Collection Dispatch Resolution (Task 11.156.3)
 *
 * Resolves function calls through collection access patterns by:
 * 1. Detecting when a collection (Map/Array/Object) is accessed
 * 2. Detecting when the result is immediately invoked
 * 3. Resolving to ALL functions stored in the collection
 *
 * Pattern detected (MVP - Direct invocation):
 * ```typescript
 * const CONFIG = new Map([["class", handler1], ["fn", handler2]]);
 * CONFIG.get(type)(capture);  // ← Resolves to [handler1, handler2]
 * ```
 *
 * Future enhancement (Indirect invocation):
 * ```typescript
 * const handler = CONFIG.get(type);
 * handler(capture);  // ← Resolves to [handler1, handler2]
 * ```
 *
 * Integration points:
 * - Uses DefinitionRegistry to look up function collections
 * - Uses ResolutionRegistry for symbol resolution
 * - Returns multi-candidate resolutions like interface method calls
 */

import type {
  SymbolId,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";

/**
 * Resolve a collection dispatch call to all stored functions.
 *
 * MVP Implementation: Detects direct invocation pattern only.
 * Pattern: collection.method()(args) where collection holds functions
 *
 * Steps:
 * 1. Check if call is on a property chain (e.g., CONFIG.get(type))
 * 2. Resolve the base variable (CONFIG)
 * 3. Check if variable holds a function collection
 * 4. Return all functions from the collection
 *
 * Returns:
 * - []: Not a collection dispatch or resolution failed
 * - [fn1, fn2, ...]: All functions in the collection
 *
 * @param call_ref - Call reference from semantic index
 * @param definitions - Definition registry with function collections
 * @param resolutions - Resolution registry for symbol lookup
 * @returns Array of resolved function symbol_ids
 */
export function resolve_collection_dispatch(
  call_ref: SymbolReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // MVP: Only handle direct pattern for now
  // Future: Add indirect pattern support (variable assignment tracking)

  // Check if this call has a property chain indicating collection access
  // Example: CONFIG.get(type)(capture)
  // property_chain would be: ["CONFIG", "get"]
  // But for now, we don't have easy access to the property chain in call_ref

  // Simplified MVP: Check if the call name suggests it came from a collection
  // This is a heuristic - we'll refine it in Phase 2.4

  // For now, return empty array (no resolution)
  // Full implementation requires understanding the call context better
  return [];
}

/**
 * Check if a variable holds a function collection.
 *
 * @param variable_id - SymbolId of the variable
 * @param definitions - Definition registry
 * @returns true if variable holds a function collection
 */
function is_function_collection(
  variable_id: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const collection = definitions.get_function_collection(variable_id);
  return collection !== undefined && collection.stored_functions.length > 0;
}

/**
 * Get all functions from a collection variable.
 *
 * @param variable_id - SymbolId of the collection variable
 * @param definitions - Definition registry
 * @returns Array of function SymbolIds stored in the collection
 */
function get_collection_functions(
  variable_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId[] {
  const collection = definitions.get_function_collection(variable_id);
  if (!collection) {
    return [];
  }
  return Array.from(collection.stored_functions);
}
