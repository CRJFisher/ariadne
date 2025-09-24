/**
 * Rust-specific type resolution (main coordinator)
 *
 * Coordinates all Rust type resolution modules and provides unified public API
 */

import type {
  LocationKey,
  TypeId,
  FilePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../../types";

// Import all specialized modules
export * from "./rust_type_utils";
export * from "./reference_types";
export * from "./ownership_ops";
export * from "./async_types";
export * from "./pattern_matching";
export * from "./function_types";
export * from "./advanced_types";

// Import key functions for the coordinator
import { resolve_rust_reference_types } from "./reference_types";
import { resolve_rust_async_types } from "./async_types";
import { integrate_pattern_matching_into_type_resolution } from "./pattern_matching";
import { resolve_rust_function_types } from "./function_types";
import { resolve_const_generics, resolve_associated_types } from "./advanced_types";
import { appears_to_be_rust_code } from "./rust_type_utils";

/**
 * Comprehensive Rust type resolution coordinator
 *
 * Orchestrates all Rust-specific type resolution modules to provide complete type information
 */
export function resolve_all_rust_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): TypeResolutionMap {
  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return type_resolution;
  }

  // Start with base type resolution
  let enhanced_resolution = { ...type_resolution };

  // Apply pattern matching integration first as it may affect other resolutions
  enhanced_resolution = integrate_pattern_matching_into_type_resolution(index, enhanced_resolution);

  // Resolve all type categories
  const reference_types = resolve_rust_reference_types(index, enhanced_resolution, file_path);
  const async_types = resolve_rust_async_types(index, enhanced_resolution, file_path);
  const function_types = resolve_rust_function_types(index, enhanced_resolution, file_path);
  const const_generic_types = resolve_const_generics(index, enhanced_resolution, file_path);
  const associated_types = resolve_associated_types(index, enhanced_resolution, file_path);

  // Merge all type resolution maps
  const merged_reference_types = new Map([
    ...enhanced_resolution.reference_types,
    ...reference_types,
    ...async_types,
    ...function_types,
    ...const_generic_types,
    ...associated_types
  ]);

  return {
    ...enhanced_resolution,
    reference_types: merged_reference_types as ReadonlyMap<LocationKey, TypeId>
  };
}