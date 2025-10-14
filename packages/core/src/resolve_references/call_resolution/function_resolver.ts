/**
 * Function Call Resolution
 *
 * Resolves function calls to their definitions using EAGER pre-computed resolutions.
 * Uses ResolutionRegistry for O(1) scope-based lookups.
 */

import type { SymbolName, FilePath, SymbolReference, CallReference } from "@ariadnejs/types";
import type { ResolutionRegistry } from "../../project/resolution_registry";

/**
 * Resolve all function calls in the given semantic indices
 *
 * EAGER approach: Uses pre-computed resolutions from ResolutionRegistry.
 * The registry has already resolved all symbols when the file was indexed.
 *
 * Resolution is O(1) per call:
 * - Look up in pre-computed scope → name map
 * - No lazy closures, no cache needed
 *
 * @param file_references - Map of file_path → references
 * @param resolutions - Resolution registry with eager resolutions
 * @returns Array of resolved function call references
 */
export function resolve_function_calls(
  file_references: Map<FilePath, readonly SymbolReference[]>,
  resolutions: ResolutionRegistry
): CallReference[] {
  const resolved_calls: CallReference[] = [];

  for (const references of file_references.values()) {
    // Filter for function call references
    const function_calls = references.filter(
      (ref) => ref.type === "call" && ref.call_type === "function"
    );

    for (const call_ref of function_calls) {
      // EAGER: O(1) lookup in pre-computed resolution map
      const resolved = resolutions.resolve(
        call_ref.scope_id,
        call_ref.name as SymbolName
      );

      if (resolved) {
        resolved_calls.push({
          ...call_ref,
          call_type: "function",
          symbol_id: resolved,
        });
      }
    }
  }

  return resolved_calls;
}
