/**
 * Collection Argument Resolution
 *
 * Resolves function calls through collection arguments to eliminate false positive entry points.
 *
 * ## Problem
 *
 * Handler functions in registry patterns appear as uncalled entry points:
 *
 * ```typescript
 * const HANDLERS = { "key": handler_function };
 * process_captures(captures, HANDLERS);  // Collection passed as argument
 *
 * // Inside process_captures:
 * const handler = registry[key];  // Dynamic lookup
 * handler(capture);               // Dynamic dispatch
 * ```
 *
 * The call graph cannot trace through parameter-based dispatch, so handler_function
 * appears as an entry point despite being called via the registry.
 *
 * ## Solution
 *
 * Detect when function collections are passed as arguments and mark all stored functions
 * as "called" at that call site.
 *
 * When we see `process_captures(captures, HANDLERS)`, we:
 * 1. Resolve HANDLERS to its symbol
 * 2. Check if HANDLERS has a function_collection
 * 3. Recursively resolve all functions in that collection
 * 4. Create call references for each function with collection_argument reason
 *
 * This complements the existing `derived_from` pattern which handles indirect invocation.
 */

import type {
  FunctionCallReference,
  MethodCallReference,
  CallReference,
  Location,
  SymbolId,
  ScopeId,
  SymbolName,
  FunctionCollection,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/registries.definition";
import type { ReferenceRegistry } from "../registries/registries.reference";
import type { ResolutionRegistry } from "../resolve_references";

/**
 * Resolve function calls through collection arguments
 *
 * Detects patterns like:
 *   `process_definitions(context, HANDLERS)`
 *
 * Where HANDLERS is a function collection. Marks all functions in
 * HANDLERS as called at the process_definitions call site.
 *
 * @param call_ref - Call reference (function or method call)
 * @param definitions - Definition registry with function collections
 * @param resolutions - Resolution registry for name resolution
 * @param references - Reference registry for location-based lookup
 * @returns Array of call references for each stored function
 */
export function resolve_collection_arguments(
  call_ref: FunctionCallReference | MethodCallReference,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  references: ReferenceRegistry
): CallReference[] {
  const implicit_calls: CallReference[] = [];

  // Early exit: no argument locations
  if (!call_ref.argument_locations || call_ref.argument_locations.length === 0) {
    return [];
  }

  // For each argument position
  for (const arg_location of call_ref.argument_locations) {
    // Resolve argument to a symbol
    const arg_symbol_id = resolve_argument_at_location(
      arg_location,
      call_ref.scope_id,
      resolutions,
      references
    );

    if (!arg_symbol_id) continue;

    // Check if this symbol has a function collection
    const collection = definitions.get_function_collection(arg_symbol_id);

    if (!collection) continue;

    // Recursively resolve all stored functions
    const stored_function_ids = resolve_collection_functions_recursive(
      collection,
      call_ref.scope_id,
      definitions,
      resolutions,
      new Set()  // visited collections (prevent cycles)
    );

    // Create implicit call reference for each function
    for (const func_id of stored_function_ids) {
      implicit_calls.push({
        location: call_ref.location,
        name: "<collection_dispatch>" as SymbolName,
        scope_id: call_ref.scope_id,
        call_type: "function",
        resolutions: [{
          symbol_id: func_id,
          confidence: "certain",
          reason: {
            type: "collection_argument",
            collection_id: arg_symbol_id,
            call_site: call_ref.location,
          },
        }],
      });
    }
  }

  return implicit_calls;
}

/**
 * Resolve argument location to a symbol
 *
 * Uses reference registry to find what symbol is referenced at this location.
 *
 * @param arg_location - Location of the argument expression
 * @param scope_id - Scope containing the call
 * @param resolutions - Resolution registry
 * @returns Symbol ID if resolved, null otherwise
 */
function resolve_argument_at_location(
  arg_location: Location,
  scope_id: ScopeId,
  resolutions: ResolutionRegistry,
  references: ReferenceRegistry
): SymbolId | null {
  // Get reference at this location
  const ref = references.get_reference_at_location(arg_location);
  if (!ref || ref.kind !== "variable_reference") {
    return null;
  }

  // Resolve the variable name
  return resolutions.resolve(scope_id, ref.name);
}

/**
 * Recursively resolve all functions in a collection
 *
 * Handles:
 * - Direct function references in stored_functions
 * - Spread operators in stored_references
 * - Nested collections (collections containing collections)
 *
 * @param collection - The function collection to resolve
 * @param scope_id - Scope for resolution context
 * @param definitions - Definition registry
 * @param resolutions - Resolution registry
 * @param visited - Set of visited collection IDs to prevent cycles
 * @returns Array of function symbol IDs
 */
function resolve_collection_functions_recursive(
  collection: FunctionCollection,
  scope_id: ScopeId,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  visited: Set<SymbolId>
): SymbolId[] {
  // Prevent infinite recursion
  if (visited.has(collection.collection_id)) {
    return [];
  }
  visited.add(collection.collection_id);

  const all_functions = new Set<SymbolId>();

  // Add directly stored functions
  for (const func_id of collection.stored_functions) {
    all_functions.add(func_id);
  }

  // Resolve stored references (e.g., ...BASE_HANDLERS)
  if (collection.stored_references) {
    for (const ref_name of collection.stored_references) {
      const ref_symbol_id = resolutions.resolve(scope_id, ref_name);
      if (!ref_symbol_id) continue;

      // Check if this reference is itself a collection
      const nested_collection = definitions.get_function_collection(ref_symbol_id);
      if (nested_collection) {
        // Recursive resolution
        const nested_functions = resolve_collection_functions_recursive(
          nested_collection,
          scope_id,
          definitions,
          resolutions,
          visited
        );
        for (const func_id of nested_functions) {
          all_functions.add(func_id);
        }
      }
    }
  }

  return Array.from(all_functions);
}
