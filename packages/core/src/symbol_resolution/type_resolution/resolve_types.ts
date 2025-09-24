import type { LocalTypeExtraction, ResolvedTypes } from "./types";
import type { FunctionResolutionMap } from "../types";
import { FilePath, SymbolName, SymbolId } from "@ariadnejs/types";

/**
 * @deprecated Use `symbol_resolution.ts::phase3_resolve_types` instead.
 *
 * This is a stub implementation preserved for backward compatibility with tests.
 * The actual type resolution has been consolidated into the unified pipeline.
 */
export function resolve_types(
  local_types: LocalTypeExtraction,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  file_indices?: Map<string, any>
): ResolvedTypes {
  // Return minimal structure for tests with correct interface shape
  // The actual implementation has been consolidated into phase3_resolve_types
  return {
    type_registry: {
      types: new Map(),
      type_names: new Map(),
    },
    symbol_types: new Map(),
    location_types: new Map(),
    type_hierarchy: {
      extends_map: new Map(),
      implements_map: new Map(),
      all_ancestors: new Map(),
      all_descendants: new Map(),
    },
    constructors: new Map(),
  };
}