/**
 * Rust async/await and Future type resolution
 *
 * Handles Future types, Pin, async/await expressions, and related async type analysis
 */

import type { Location, LocationKey, TypeId, FilePath } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../../index_single_file/semantic_index";
import type { TypeResolutionMap } from "../../types";
import type { NormalizedCapture } from "../../../index_single_file/capture_types";
import {
  appears_to_be_rust_code,
  is_rust_future_type,
  extract_balanced_generic_content,
} from "./rust_type_utils";

/**
 * Extract the output type from a Future type
 * For Future<Output = T>, extracts T
 */
export function extract_future_output_type(
  future_type_id: TypeId
): TypeId | null {
  const type_str = future_type_id.toString();

  // Match patterns like Future<Output = T> or impl Future<Output = T>
  // Handle nested generics by counting angle brackets
  const output_match = type_str.match(/Future<Output\s*=\s*(.+)>$/);
  if (output_match) {
    return extract_balanced_generic_content(output_match[1]) as TypeId;
  }

  // Match simpler patterns like Future<T>
  const simple_match = type_str.match(/Future<(.+)>$/);
  if (simple_match) {
    return extract_balanced_generic_content(simple_match[1]) as TypeId;
  }

  return null;
}

/**
 * Resolve async/await specific type information
 */
export function resolve_rust_async_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const async_types = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return async_types;
  }

  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return async_types;
  }

  // Process await expressions
  for (const ref of all_references) {
    if (ref.modifiers?.is_await && ref.location) {
      const await_type = resolve_await_expression_type(ref, type_resolution);
      if (await_type) {
        async_types.set(location_key(ref.location), await_type);
      }
    }

    // Process async function calls
    if (ref.modifiers?.is_async && ref.location) {
      const async_return_type = resolve_async_function_return_type(
        ref,
        type_resolution
      );
      if (async_return_type) {
        async_types.set(location_key(ref.location), async_return_type);
      }
    }
  }

  return async_types;
}

/**
 * Resolve the type of an await expression
 * For `future.await`, returns the output type of the Future
 */
function resolve_await_expression_type(
  await_ref: NormalizedCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // The await expression should have context about the target being awaited
  if (await_ref.context?.await_target) {
    // Try to find the type of the awaited expression
    const target_location_key = location_key(await_ref.location);
    const future_type =
      type_resolution.reference_types.get(target_location_key);

    if (future_type && is_rust_future_type(future_type)) {
      return extract_future_output_type(future_type);
    }
  }

  return null;
}

/**
 * Resolve the return type of an async function call
 * Async functions return Future<Output = T> where T is the declared return type
 */
function resolve_async_function_return_type(
  async_ref: NormalizedCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // For async functions, we need to wrap the return type in a Future
  // This is a simplified approach - in practice we'd need to analyze the function signature

  if (async_ref.text && async_ref.text.includes("async")) {
    // Create a synthetic Future type
    // In a complete implementation, this would be more sophisticated
    return `Future<${async_ref.text}>` as TypeId;
  }

  return null;
}

/**
 * Get Future trait methods available on Future types
 */
export function get_future_trait_methods(type_id: TypeId): string[] {
  if (is_rust_future_type(type_id)) {
    return ["map", "then", "and_then", "or_else", "boxed", "fuse"];
  }
  return [];
}

/**
 * Get the methods available on a Rust reference type
 */
export function get_rust_reference_methods(type_id: TypeId): string[] {
  // Reference types in Rust have automatic deref, so they inherit methods
  // from the referenced type. This would need deep type system integration
  // to implement fully.
  return [];
}
