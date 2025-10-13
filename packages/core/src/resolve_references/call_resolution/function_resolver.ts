/**
 * Function Call Resolution
 *
 * Resolves function calls to their definitions using on-demand scope-aware lookup.
 * Delegates to ScopeResolverIndex with caching.
 */

import type { SymbolId, LocationKey, FilePath } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolverIndex } from "../scope_resolver_index/scope_resolver_index";
import type { ResolutionCache } from "../resolution_cache/resolution_cache";

/**
 * Map of call location → resolved function symbol_id
 */
export type FunctionCallMap = Map<LocationKey, SymbolId>;

/**
 * Resolve all function calls in the given semantic indices
 *
 * This is the simplest resolver - it delegates all the heavy lifting to ScopeResolverIndex.
 * The resolver handles:
 * - Local function calls (functions in same file/scope)
 * - Imported function calls (functions from other files)
 * - Shadowing (local functions override imports)
 * - Nested scope resolution (lexical scoping)
 *
 * Resolution is on-demand with caching:
 * - Only referenced functions are resolved (no pre-computation)
 * - Cache ensures repeated lookups are O(1)
 *
 * @param indices - Map of file_path → SemanticIndex
 * @param resolver_index - Scope resolver index for on-demand lookups
 * @param cache - Resolution cache for O(1) repeated lookups
 * @returns Map of call location → resolved function symbol_id
 */
export function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache
): FunctionCallMap {
  const resolutions = new Map<LocationKey, SymbolId>();

  for (const index of indices.values()) {
    // Filter for function call references
    const function_calls = index.references.filter(
      (ref) => ref.type === "call" && ref.call_type === "function"
    );

    for (const call_ref of function_calls) {
      // Resolve ON-DEMAND with caching - that's it!
      const resolved = resolver_index.resolve(
        call_ref.scope_id,
        call_ref.name,
        cache
      );

      if (resolved) {
        const key = location_key(call_ref.location);
        resolutions.set(key, resolved);
      }
    }
  }

  return resolutions;
}
