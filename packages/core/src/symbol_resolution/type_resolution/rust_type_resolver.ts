/**
 * Rust-specific type resolution
 *
 * Handles Rust ownership types, references, smart pointers, and pattern matching in type resolution
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../types";
import type { SemanticCapture } from "../../semantic_index/capture_types";
import { SemanticEntity, SemanticCategory } from "../../semantic_index/capture_types";

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

/**
 * Pattern matching information
 */
export interface PatternMatchInfo {
  pattern_type: "match_arm" | "if_let" | "while_let" | "for_loop" | "let_destructure";
  bound_variables: SymbolId[];
  matched_type?: TypeId;
  destructure_type?: "struct" | "tuple" | "enum" | "slice";
  location: Location;
}

/**
 * Resolve pattern matching constructs and bound variables
 */
export function resolve_pattern_matching(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, PatternMatchInfo> {
  const pattern_matches = new Map<LocationKey, PatternMatchInfo>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return pattern_matches;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return pattern_matches;
  }

  // Process match arms
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.match_arm" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "match_arm",
        bound_variables: bound_vars,
        location: ref.location
      });
    }

    // Process if-let expressions
    if (ref.capture_name === "pattern.if_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_if_let_matched_type(ref, all_references, type_resolution);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "if_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location
      });
    }

    // Process while-let expressions
    if (ref.capture_name === "pattern.while_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_while_let_matched_type(ref, all_references, type_resolution);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "while_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location
      });
    }

    // Process struct destructuring
    if (ref.capture_name === "pattern.struct_destructure" && ref.location) {
      const bound_vars = find_struct_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "struct",
        location: ref.location
      });
    }

    // Process tuple destructuring
    if (ref.capture_name === "pattern.tuple_destructure" && ref.location) {
      const bound_vars = find_tuple_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "tuple",
        location: ref.location
      });
    }
  }

  return pattern_matches;
}

/**
 * Find variables bound by a pattern
 */
function find_pattern_bound_variables(
  pattern_ref: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for variable.pattern captures near this pattern location
  for (const ref of all_references) {
    if (ref.capture_name === "variable.pattern" &&
        ref.location &&
        pattern_ref.location &&
        locations_are_near(ref.location, pattern_ref.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by struct destructuring
 */
function find_struct_destructure_variables(
  struct_pattern: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for pattern variables within the struct destructuring location
  for (const ref of all_references) {
    if ((ref.entity === SemanticEntity.VARIABLE &&
         ref.category === SemanticCategory.DEFINITION) &&
        ref.location &&
        struct_pattern.location &&
        locations_are_near(ref.location, struct_pattern.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by tuple destructuring
 */
function find_tuple_destructure_variables(
  tuple_pattern: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Similar to struct destructuring but for tuple patterns
  for (const ref of all_references) {
    if ((ref.entity === SemanticEntity.VARIABLE &&
         ref.category === SemanticCategory.DEFINITION) &&
        ref.location &&
        tuple_pattern.location &&
        locations_are_near(ref.location, tuple_pattern.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Resolve the type being matched in if-let expressions
 */
function resolve_if_let_matched_type(
  if_let_pattern: SemanticCapture,
  all_references: SemanticCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding if_let_value capture
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.if_let_value" &&
        ref.location &&
        if_let_pattern.location &&
        locations_are_near(ref.location, if_let_pattern.location)) {

      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(location_key(ref.location));
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Resolve the type being matched in while-let expressions
 */
function resolve_while_let_matched_type(
  while_let_pattern: SemanticCapture,
  all_references: SemanticCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding while_let_value capture
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.while_let_value" &&
        ref.location &&
        while_let_pattern.location &&
        locations_are_near(ref.location, while_let_pattern.location)) {

      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(location_key(ref.location));
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Check if two locations are near each other (same match expression or similar context)
 */
function locations_are_near(loc1: Location, loc2: Location): boolean {
  // Simple heuristic: same file and within reasonable line distance
  return loc1.file_path === loc2.file_path &&
         Math.abs(loc1.start_line - loc2.start_line) <= 5;
}

/**
 * Resolve pattern-conditional method calls
 * These are method calls that happen within pattern match arms or if-let/while-let blocks
 */
export function resolve_pattern_conditional_calls(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  pattern_matches: Map<LocationKey, PatternMatchInfo>
): Map<LocationKey, { method_call: LocationKey, pattern_context: PatternMatchInfo }> {
  const conditional_calls = new Map<LocationKey, { method_call: LocationKey, pattern_context: PatternMatchInfo }>();

  if (!appears_to_be_rust_code(index) || !index.references?.calls) {
    return conditional_calls;
  }

  // Look for method calls within pattern match contexts
  for (const call of index.references.calls) {
    if (call.location) {
      const call_key = location_key(call.location);

      // Find if this call is within any pattern context
      for (const [pattern_key, pattern_info] of pattern_matches) {
        if (call_is_in_pattern_scope(call.location, pattern_info)) {
          conditional_calls.set(call_key, {
            method_call: call_key,
            pattern_context: pattern_info
          });
          break;
        }
      }
    }
  }

  return conditional_calls;
}

/**
 * Check if a method call is within a pattern match scope
 */
function call_is_in_pattern_scope(call_location: Location, pattern_info: PatternMatchInfo): boolean {
  // Simple heuristic: call is after the pattern and within reasonable distance
  return call_location.file_path === pattern_info.location.file_path &&
         call_location.start_line >= pattern_info.location.start_line &&
         call_location.start_line <= pattern_info.location.start_line + 10; // Reasonable scope distance
}

/**
 * Integrate pattern matching information into the main type resolution
 */
export function integrate_pattern_matching_into_type_resolution(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeResolutionMap {
  if (!appears_to_be_rust_code(index)) {
    return type_resolution;
  }

  const pattern_matches = resolve_pattern_matching(index, type_resolution);
  const conditional_calls = resolve_pattern_conditional_calls(index, type_resolution, pattern_matches);

  // Create enhanced type resolution with pattern information
  // For now, we'll extend the existing maps rather than create new interfaces
  // In a complete implementation, this would need dedicated pattern-aware type maps

  const enhanced_symbol_types = new Map(type_resolution.symbol_types);
  const enhanced_reference_types = new Map(type_resolution.reference_types);

  // Process pattern-bound variables and their types
  for (const [pattern_key, pattern_info] of pattern_matches) {
    // If we know the matched type, assign it to bound variables
    if (pattern_info.matched_type) {
      for (const var_id of pattern_info.bound_variables) {
        enhanced_symbol_types.set(var_id, pattern_info.matched_type);
      }
    }

    // For destructuring patterns, we'd need to resolve field types
    // This would require more sophisticated type analysis
  }

  return {
    ...type_resolution,
    symbol_types: enhanced_symbol_types as ReadonlyMap<SymbolId, TypeId>,
    reference_types: enhanced_reference_types as ReadonlyMap<LocationKey, TypeId>
  };
}