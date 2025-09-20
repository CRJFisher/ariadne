import type { LocalTypeExtraction, ResolvedTypes } from "./types";
import type { ImportResolutionMap, FunctionResolutionMap } from "../types";
import { resolve_all_types } from "./type_resolution";

/**
 * Main entry point for type resolution
 */
export function resolve_types(
  local_types: LocalTypeExtraction,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  file_indices?: Map<string, any>
): ResolvedTypes {
  // Use the full type resolution implementation
  return resolve_all_types(
    local_types,
    imports,
    functions,
    file_indices || new Map()
  );
}