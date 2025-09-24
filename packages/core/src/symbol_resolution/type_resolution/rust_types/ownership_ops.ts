/**
 * Rust ownership operations resolution
 *
 * Handles borrow operations, dereferences, and ownership transfer tracking
 */

import type {
  Location,
  LocationKey,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../../types";
import {
  appears_to_be_rust_code
} from "./rust_type_utils";

/**
 * Ownership operation information
 */
export interface OwnershipOperation {
  operation: "borrow" | "dereference" | "smart_pointer_method";
  is_mutable?: boolean;
  method_name?: string;
  location: Location;
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