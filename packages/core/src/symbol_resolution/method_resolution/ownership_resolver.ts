/**
 * Rust ownership semantics resolver
 *
 * Handles Rust-specific ownership operations in method resolution:
 * - Reference/dereference operations (&x, *x)
 * - Smart pointer method calls (Box, Rc, Arc, RefCell)
 * - Borrow checking for method calls
 * - Move semantics awareness
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  TypeId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references/member_access_references";
import type { MethodLookupContext } from "./method_types";
import type { NormalizedCapture } from "../../semantic_index/capture_types";

/**
 * Resolve receiver type through Rust ownership operations
 */
export function resolve_ownership_receiver_type(
  member_access: MemberAccessReference,
  context: MethodLookupContext,
  index: SemanticIndex
): TypeId | null {
  if (!member_access.object.location) {
    return null;
  }

  // Check if the receiver object is involved in ownership operations
  const receiver_location = member_access.object.location;
  const ownership_info = analyze_ownership_context(receiver_location, index);

  if (!ownership_info) {
    return null;
  }

  // Handle different ownership patterns
  switch (ownership_info.operation_type) {
    case "borrow":
      return resolve_borrow_receiver_type(ownership_info, context);
    case "dereference":
      return resolve_dereference_receiver_type(ownership_info, context);
    case "smart_pointer":
      return resolve_smart_pointer_receiver_type(ownership_info, context);
    default:
      return null;
  }
}

/**
 * Analyze ownership context around a location
 */
function analyze_ownership_context(
  location: Location,
  index: SemanticIndex
): OwnershipContext | null {
  const location_key_val = location_key(location);

  // Safe check for references
  if (!index.references || !index.references.all_references || !Array.isArray(index.references.all_references)) {
    return null;
  }

  // Look for ownership operations in references
  for (const ref of index.references.all_references) {
    if (ref.location && location_key(ref.location) === location_key_val) {
      // Check for borrow operations
      if (ref.modifiers?.is_borrow) {
        return {
          operation_type: "borrow",
          is_mutable: ref.modifiers.is_mutable_borrow || false,
          capture: ref,
          target_location: location
        };
      }

      // Check for dereference operations
      if (ref.modifiers?.is_dereference) {
        return {
          operation_type: "dereference",
          capture: ref,
          target_location: location
        };
      }

      // Check for smart pointer operations
      if (ref.modifiers?.is_smart_pointer_method) {
        return {
          operation_type: "smart_pointer",
          method_name: ref.text,
          capture: ref,
          target_location: location
        };
      }
    }
  }

  return null;
}

/**
 * Resolve method calls on borrowed values (&x.method())
 */
function resolve_borrow_receiver_type(
  ownership: OwnershipContext,
  context: MethodLookupContext
): TypeId | null {
  // For borrow operations, we need to find the original value's type
  // and then create a reference type

  const borrowed_value_location = find_borrowed_value_location(ownership);
  if (!borrowed_value_location) {
    return null;
  }

  const base_type = context.type_resolution.reference_types.get(
    location_key(borrowed_value_location)
  );

  if (!base_type) {
    return null;
  }

  // In Rust, &T methods are available on T through auto-deref
  // So we can use the base type for method resolution
  return base_type;
}

/**
 * Resolve method calls through dereference (*x.method())
 */
function resolve_dereference_receiver_type(
  ownership: OwnershipContext,
  context: MethodLookupContext
): TypeId | null {
  // For dereference operations, we need to find what type this points to
  const pointer_location = ownership.target_location;
  const pointer_type = context.type_resolution.reference_types.get(
    location_key(pointer_location)
  );

  if (!pointer_type) {
    return null;
  }

  // TODO: In a full implementation, we'd need to track what type
  // this pointer/reference points to. For now, we return the pointer type
  // which may work for simple cases due to Rust's deref coercion
  return pointer_type;
}

/**
 * Resolve method calls on smart pointers (box.method(), rc.method())
 */
function resolve_smart_pointer_receiver_type(
  ownership: OwnershipContext,
  context: MethodLookupContext
): TypeId | null {
  const smart_ptr_location = ownership.target_location;
  const smart_ptr_type = context.type_resolution.reference_types.get(
    location_key(smart_ptr_location)
  );

  if (!smart_ptr_type) {
    return null;
  }

  // Smart pointer method calls should resolve to methods on the smart pointer type itself
  // (like Box::new, Rc::clone, RefCell::borrow, etc.)
  return smart_ptr_type;
}

/**
 * Find the location of the value being borrowed
 */
function find_borrowed_value_location(ownership: OwnershipContext): Location | null {
  // In a borrow operation like &x, we need to find the location of 'x'
  // This would require parsing the capture context or AST traversal
  // For now, we return the target location as a simplification
  return ownership.target_location;
}

/**
 * Check if a method call should use Rust-specific ownership semantics
 */
export function should_use_ownership_semantics(
  member_access: MemberAccessReference,
  index: SemanticIndex
): boolean {
  if (!member_access.object.location) {
    return false;
  }

  // Check if this is explicitly marked as Rust
  if (index.language === "rust") {
    return true;
  }

  // Safe check for references with null safety
  if (!index.references || !index.references.all_references) {
    return false;
  }

  // Check if this is Rust code by looking for Rust-specific captures
  try {
    const has_rust_captures = index.references.all_references.some(ref =>
      ref.modifiers?.is_borrow ||
      ref.modifiers?.is_dereference ||
      ref.modifiers?.is_smart_pointer ||
      ref.modifiers?.is_lifetime
    );

    return has_rust_captures;
  } catch (error) {
    // If all_references is not iterable or any other error, assume not Rust
    return false;
  }
}

/**
 * Get smart pointer methods that should be available
 */
export function get_smart_pointer_methods(smart_pointer_type: string): string[] {
  const methods_map: Record<string, string[]> = {
    "Box": ["new", "leak", "into_raw", "from_raw"],
    "Rc": ["new", "clone", "try_unwrap", "get_mut", "downgrade", "weak_count", "strong_count"],
    "Arc": ["new", "clone", "try_unwrap", "get_mut", "downgrade", "weak_count", "strong_count"],
    "RefCell": ["new", "borrow", "borrow_mut", "try_borrow", "try_borrow_mut", "get_mut"],
    "Mutex": ["new", "lock", "try_lock", "get_mut"],
    "RwLock": ["new", "read", "write", "try_read", "try_write", "get_mut"],
  };

  return methods_map[smart_pointer_type] || [];
}

/**
 * Ownership context information
 */
interface OwnershipContext {
  operation_type: "borrow" | "dereference" | "smart_pointer";
  is_mutable?: boolean;
  method_name?: string;
  capture: NormalizedCapture;
  target_location: Location;
}