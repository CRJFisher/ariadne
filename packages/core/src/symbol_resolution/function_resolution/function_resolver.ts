/**
 * Main function call resolution algorithm
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { CallReference } from "../../semantic_index/references/call_references/call_references";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type {
  FunctionCallResolution,
  FunctionResolutionMap,
  FunctionResolutionContext,
} from "./function_types";
import {
  try_lexical_resolution,
  try_imported_resolution,
  try_global_resolution,
  try_builtin_resolution,
} from "./resolution_priority";

/**
 * Resolve all function calls across all files
 */
export function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): FunctionResolutionMap {
  const function_calls = new Map<LocationKey, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();
  const resolution_details = new Map<LocationKey, FunctionCallResolution>();

  indices.forEach((index, file_path) => {
    const file_imports = imports.get(file_path) || new Map();
    const context: FunctionResolutionContext = {
      indices,
      imports,
      file_path,
      file_index: index,
      file_imports,
    };

    // Process all function call references in this file
    for (const call_ref of index.references.calls) {
      if (call_ref.call_type === "function") {
        const resolution = resolve_single_function_call(call_ref, context);

        if (resolution) {
          const location_key_val = location_key(call_ref.location);

          function_calls.set(location_key_val, resolution.resolved_function);
          resolution_details.set(location_key_val, resolution);

          // Update reverse mapping
          const call_locations = calls_to_function.get(
            resolution.resolved_function
          );
          if (call_locations) {
            call_locations.push(call_ref.location);
          } else {
            calls_to_function.set(resolution.resolved_function, [
              call_ref.location,
            ]);
          }
        }
      }
    }
  });

  return {
    function_calls: function_calls as ReadonlyMap<LocationKey, SymbolId>,
    calls_to_function: calls_to_function as ReadonlyMap<SymbolId, readonly Location[]>,
    resolution_details: resolution_details as ReadonlyMap<LocationKey, FunctionCallResolution>
  };
}

/**
 * Resolve a single function call using multiple strategies
 */
function resolve_single_function_call(
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const function_name = call_ref.name;

  // Resolution priority order
  const resolution_strategies = [
    () => try_lexical_resolution(function_name, call_ref, context),
    () => try_imported_resolution(function_name, call_ref, context),
    () => try_global_resolution(function_name, call_ref, context),
    () => try_builtin_resolution(function_name, call_ref, context),
  ];

  for (const strategy of resolution_strategies) {
    const result = strategy();
    if (result) {
      return result;
    }
  }

  return null; // Unresolved
}