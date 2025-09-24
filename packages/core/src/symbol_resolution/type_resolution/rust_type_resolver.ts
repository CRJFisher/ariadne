/**
 * Rust-specific type resolution
 *
 * Handles Rust ownership types, references, and smart pointers in type resolution
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../types";
import type { SemanticCapture } from "../../semantic_index/capture_types";

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
        return type_id;
      }
    }
  }

  return null;
}

/**
 * Extract smart pointer name from type text
 */
function extract_smart_pointer_name(type_text: string): string {
  // Match patterns like "Box<T>", "Rc<RefCell<T>>" etc.
  const match = type_text.match(/^(\w+)</);
  return match ? match[1] : type_text;
}

/**
 * Resolve ownership transfer operations
 */
export function resolve_ownership_operations(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, OwnershipOperation> {
  const ownership_ops = new Map<LocationKey, OwnershipOperation>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return ownership_ops;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return ownership_ops;
  }

  // Process borrow operations
  for (const ref of all_references) {
    if (ref.modifiers?.is_borrow && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "borrow",
        is_mutable: ref.modifiers.is_mutable_borrow || false,
        location: ref.location
      });
    }

    // Process dereference operations
    if (ref.modifiers?.is_dereference && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "dereference",
        location: ref.location
      });
    }

    // Process smart pointer method calls
    if (ref.modifiers?.is_smart_pointer_method && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "smart_pointer_method",
        method_name: ref.text,
        location: ref.location
      });
    }
  }

  return ownership_ops;
}

/**
 * Check if a type is a Rust reference type
 */
export function is_rust_reference_type(type_id: TypeId): boolean {
  // In a complete implementation, this would check the TypeId metadata
  // For now, we'll use string matching as a heuristic
  return type_id.toString().includes('&') || type_id.toString().includes('ref');
}

/**
 * Check if a type is a Rust smart pointer
 */
export function is_rust_smart_pointer_type(type_id: TypeId): boolean {
  const smart_pointer_names = ['Box', 'Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock'];
  const type_str = type_id.toString();

  return smart_pointer_names.some(name => type_str.includes(name));
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

/**
 * Check if this appears to be Rust code based on semantic captures
 */
function appears_to_be_rust_code(index: SemanticIndex): boolean {
  // Check if this is explicitly marked as Rust
  if (index.language === "rust") {
    return true;
  }

  // Safe check for references with null safety
  if (!index.references || !index.references.all_references) {
    return false;
  }

  // Check for Rust-specific captures
  try {
    return index.references.all_references.some(ref =>
      ref.modifiers?.is_borrow ||
      ref.modifiers?.is_dereference ||
      ref.modifiers?.is_smart_pointer ||
      ref.modifiers?.is_lifetime ||
      ref.modifiers?.is_trait_method
    );
  } catch (error) {
    // If all_references is not iterable or any other error, assume not Rust
    return false;
  }
}

/**
 * Ownership operation information
 */
export interface OwnershipOperation {
  operation: "borrow" | "dereference" | "smart_pointer_method";
  is_mutable?: boolean;
  method_name?: string;
  location: Location;
}