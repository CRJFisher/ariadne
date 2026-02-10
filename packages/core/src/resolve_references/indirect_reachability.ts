/**
 * Indirect reachability detection.
 *
 * Detects functions that are reachable without direct call edges:
 * - Functions stored in collections that are read (e.g., `return HANDLERS`)
 * - Named functions passed as values/arguments (e.g., `apply(doubler, 21)`)
 *
 * These functions should not be considered entry points.
 */

import type { FilePath, SymbolId, SymbolName, Location, FunctionCollection, IndirectReachabilityReason } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";

/**
 * Entry for indirectly reachable function
 */
export interface IndirectReachabilityEntry {
  function_id: SymbolId;
  reason: IndirectReachabilityReason;
}

/**
 * Resolver function type for looking up symbols by name in a scope
 */
export type SymbolResolver = (scope_id: string, name: SymbolName) => SymbolId | null;

/**
 * Reference with the fields needed for collection read detection
 */
interface VariableReadReference {
  kind: string;
  access_type?: string;
  scope_id: string;
  name: SymbolName;
  location: Location;
}

/**
 * Detect indirect reachability from variable read references.
 *
 * Handles two cases:
 * 1. Function collections: when a collection variable is read, all stored functions
 *    become indirectly reachable.
 * 2. Function references: when a named function is read as a value (e.g., passed
 *    as an argument), it becomes indirectly reachable.
 *
 * @param file_references - Map of file_path → references
 * @param definitions - Definition registry
 * @param resolve - Function to resolve symbol names in scopes
 * @returns Map of function_id to IndirectReachabilityEntry
 */
export function detect_indirect_reachability(
  file_references: Map<FilePath, readonly VariableReadReference[]>,
  definitions: DefinitionRegistry,
  resolve: SymbolResolver
): Map<SymbolId, IndirectReachabilityEntry> {
  const indirect_reachability = new Map<SymbolId, IndirectReachabilityEntry>();

  for (const references of file_references.values()) {
    for (const ref of references) {
      // Only process variable reads
      if (ref.kind !== "variable_reference" || ref.access_type !== "read") {
        continue;
      }

      // Resolve the referenced symbol
      const symbol_id = resolve(ref.scope_id, ref.name);
      if (!symbol_id) continue;

      // Check if it has function_collection metadata
      const collection = definitions.get_function_collection(symbol_id);
      if (collection) {
        mark_collection_as_consumed(
          symbol_id,
          collection,
          ref.location,
          definitions,
          resolve,
          indirect_reachability,
          new Set()
        );
        continue;
      }

      // Check if the resolved symbol is a function definition (passed as value)
      const def = definitions.get(symbol_id);
      if (def && def.kind === "function") {
        // Skip if the reference is at the definition site itself
        // (e.g., Python's `def foo` creates a variable_reference read at the def location)
        if (
          ref.location.file_path === def.location.file_path &&
          ref.location.start_line === def.location.start_line &&
          ref.location.start_column === def.location.start_column
        ) {
          continue;
        }
        indirect_reachability.set(symbol_id, {
          function_id: symbol_id,
          reason: { type: "function_reference", read_location: ref.location },
        });
      }
    }
  }

  return indirect_reachability;
}

/**
 * Mark all functions in a collection as indirectly reachable.
 * Recursively handles spread operators (e.g., ...JAVASCRIPT_HANDLERS).
 *
 * @param collection_id - SymbolId of the collection variable
 * @param collection - FunctionCollection metadata
 * @param read_location - Location where the collection was read
 * @param definitions - Definition registry
 * @param resolve - Function to resolve symbol names in scopes
 * @param indirect_reachability - Map to add entries to
 * @param visited - Set of already visited collection IDs (for cycle detection)
 */
function mark_collection_as_consumed(
  collection_id: SymbolId,
  collection: FunctionCollection,
  read_location: Location,
  definitions: DefinitionRegistry,
  resolve: SymbolResolver,
  indirect_reachability: Map<SymbolId, IndirectReachabilityEntry>,
  visited: Set<SymbolId>
): void {
  // Prevent infinite recursion on circular references
  if (visited.has(collection_id)) return;
  visited.add(collection_id);

  // Mark inline functions (stored_functions: SymbolId[])
  for (const fn_id of collection.stored_functions) {
    indirect_reachability.set(fn_id, {
      function_id: fn_id,
      reason: {
        type: "collection_read",
        collection_id,
        read_location,
      },
    });
  }

  // Resolve stored references (stored_references: SymbolName[])
  // These are function names or spread variable names like ["handler_foo", "JAVASCRIPT_HANDLERS"]
  if (collection.stored_references) {
    // Get the scope where the collection variable is defined
    const collection_def = definitions.get(collection_id);
    if (!collection_def) return;
    const defining_scope = collection_def.defining_scope_id;

    for (const ref_name of collection.stored_references) {
      // Resolve the name in the collection's defining scope
      const ref_id = resolve(defining_scope, ref_name);
      if (!ref_id) continue;

      const ref_def = definitions.get(ref_id);
      if (!ref_def) continue;

      if (ref_def.kind === "function") {
        // Direct function reference - mark as reachable
        indirect_reachability.set(ref_id, {
          function_id: ref_id,
          reason: {
            type: "collection_read",
            collection_id,
            read_location,
          },
        });
      } else if (
        (ref_def.kind === "variable" || ref_def.kind === "constant") &&
        ref_def.function_collection
      ) {
        // Nested collection (spread) - resolve recursively
        mark_collection_as_consumed(
          ref_id,
          ref_def.function_collection,
          read_location,
          definitions,
          resolve,
          indirect_reachability,
          visited
        );
      }
    }
  }
}
