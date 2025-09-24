/**
 * Rust reference types and smart pointer resolution
 *
 * Handles Rust reference types (&T, &mut T), smart pointers (Box, Rc, Arc), and related type analysis
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../types";
import type { SemanticCapture } from "../../semantic_index/capture_types";
import {
  appears_to_be_rust_code,
  extract_smart_pointer_name
} from "./rust_type_utils";

/**
 * Resolve Rust reference types (&T, &mut T)
 */
export function resolve_rust_reference_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const reference_types = new Map<LocationKey, TypeId>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return reference_types;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return reference_types;
  }

  // Process type captures from the references - reference types come through as references, not local_types
  for (const type_capture of all_references) {
    if (type_capture.modifiers?.is_reference && type_capture.location) {
      const location_key_val = location_key(type_capture.location);

      // For reference types, we need to find the inner type
      const inner_type = resolve_reference_inner_type(type_capture, type_resolution);
      if (inner_type) {
        reference_types.set(location_key_val, inner_type);
      }
    }

    // Also process smart pointer types
    if (type_capture.modifiers?.is_smart_pointer && type_capture.location) {
      const location_key_val = location_key(type_capture.location);

      const smart_ptr_type = resolve_smart_pointer_type(type_capture, type_resolution);
      if (smart_ptr_type) {
        reference_types.set(location_key_val, smart_ptr_type);
      }
    }
  }

  return reference_types;
}

/**
 * Resolve the inner type of a reference type
 */
function resolve_reference_inner_type(
  reference_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // In a full implementation, we would need to parse the type annotation
  // to extract the inner type from &T or &mut T
  // For now, we'll use the type name if available
  if (reference_capture.text) {
    // Remove the reference sigil to get the inner type name
    const inner_type_name = reference_capture.text.replace(/^&\s*(mut\s*)?/, '');

    // Look up the inner type in the type resolution map
    for (const [type_id, type_info] of type_resolution.symbol_types) {
      if (type_info && type_info.toString().includes(inner_type_name)) {
        return type_id;
      }
    }
  }

  return null;
}

/**
 * Resolve smart pointer type information
 */
function resolve_smart_pointer_type(
  smart_ptr_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // For smart pointers like Box<T>, Rc<T>, we need to identify the smart pointer type
  // and potentially track the inner type T

  if (smart_ptr_capture.text) {
    const smart_ptr_name = extract_smart_pointer_name(smart_ptr_capture.text);

    // Look for the smart pointer type definition
    for (const [type_id, type_info] of type_resolution.symbol_types) {
      if (type_info && type_info.toString().includes(smart_ptr_name)) {
        return type_info;
      }
    }
  }

  return null;
}