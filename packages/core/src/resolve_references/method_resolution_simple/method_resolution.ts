import {
  type FilePath,
  type SymbolName,
  type SymbolId,
  type LocationKey,
  type Location,
  location_key,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { MethodCallResolution } from "../method_resolution/method_types";
import type {
  FunctionResolutionMap,
  MethodAndConstructorResolutionMap as MethodAndConstructorResolutionMap,
} from "../types";
import {
  build_method_index,
  resolve_method_heuristic,
} from "./heuristic_resolver";
import type { HeuristicLookupContext } from "./heuristic_types";
import { LocalTypeContext } from "../local_type_context/local_type_context";

/**
 * Method and Constructor Resolution
 *
 * Uses heuristic-based approach to resolve method calls efficiently:
 * 1. Build global method index
 * 2. Apply resolution strategies in priority order
 * 3. Fall back to enhanced resolution for complex cases
 */
export function resolve_methods(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  local_types: Map<FilePath, LocalTypeContext>
): MethodAndConstructorResolutionMap {
  const method_calls = new Map<LocationKey, SymbolId>();
  const constructor_calls = new Map<LocationKey, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();

  // Build global method index for efficient lookup
  const method_index = build_method_index(indices);

  // Process each file
  for (const [file_path, index] of indices) {
    const local_types_in_file = local_types.get(file_path);
    if (!local_types_in_file) {
      throw new Error(`Local type context not found for file ${file_path}`);
    }

    // Create heuristic context for fast resolution
    const heuristic_context: HeuristicLookupContext = {
      imports,
      current_file: file_path,
      current_index: index,
      indices,
      local_type_context: local_types_in_file,
    };

    // Process method calls
    if (index.references?.member_accesses) {
      for (const member_access of index.references.member_accesses) {
        if (member_access.access_type !== "method") continue;

        // Try heuristic resolution first (handles 95% of cases)
        const heuristic_result = resolve_method_heuristic(
          member_access,
          heuristic_context,
          method_index
        );

        if (heuristic_result) {
          const loc_key = location_key(member_access.location);
          method_calls.set(loc_key, heuristic_result.method_id);
          const calls = calls_to_method.get(heuristic_result.method_id) || [];
          calls.push(member_access.location);
          calls_to_method.set(heuristic_result.method_id, calls);
        }
      }
    }

    // Process constructor calls with simplified resolution
    if (index.local_type_flow?.constructor_calls) {
      for (const ctor_call of index.local_type_flow.constructor_calls) {
        const resolved = resolve_constructor_simple(
          ctor_call,
          file_path,
          imports,
          indices
        );

        if (resolved) {
          const loc_key = location_key(ctor_call.location);
          constructor_calls.set(loc_key, resolved);

          // Update reverse mapping
          const calls = calls_to_method.get(resolved) || [];
          calls.push(ctor_call.location);
          calls_to_method.set(resolved, calls);
        }
      }
    }
  }

  return {
    method_calls,
    constructor_calls,
    calls_to_method,
  };
}
/**
 * Simplified constructor resolution
 */

export function resolve_constructor_simple(
  ctor_call: any,
  file_path: FilePath,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): SymbolId | null {
  const type_name = ctor_call.class_name;

  // Try imports first
  const imported_symbol = imports.get(file_path)?.get(type_name);
  if (imported_symbol) {
    // Verify it's a class
    for (const [_, index] of indices) {
      const symbol = index.symbols.get(imported_symbol);
      if (symbol?.kind === "class") {
        return imported_symbol;
      }
    }
  }

  // Try local symbols
  const current_index = indices.get(file_path);
  if (current_index) {
    for (const [symbol_id, symbol] of current_index.symbols) {
      if (symbol.kind === "class" && symbol.name === type_name) {
        return symbol_id;
      }
    }
  }

  return null;
}
