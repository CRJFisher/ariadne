/**
 * Rust advanced type features resolution
 *
 * Handles const generics, associated types, unsafe contexts, loop constructs, and other advanced Rust features
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../../types";
import type { NormalizedCapture } from "../../../semantic_index/capture_types";
import {
  appears_to_be_rust_code,
  create_builtin_type_id,
  create_abstract_type_id
} from "./rust_type_utils";

/**
 * Resolve const generics information from semantic captures
 */
export function resolve_const_generics(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const const_generic_types = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return const_generic_types;
  }

  // Process definitions to find const generic parameters
  for (const [symbol_id, symbol] of index.symbols) {
    if (symbol.kind === 'constant' &&
        symbol.modifiers?.is_const_generic &&
        symbol.location) {

      const location_key_val = location_key(symbol.location);

      // Create or find appropriate TypeId for const generic
      // In Rust, const generics have types like usize, u32, etc.
      const const_generic_type = resolve_const_generic_type(
        symbol,
        type_resolution,
        file_path
      );

      if (const_generic_type) {
        const_generic_types.set(location_key_val, const_generic_type);
      }
    }
  }

  // Also check references for const generic usage
  const all_references = index.references?.all_references;
  if (all_references && Array.isArray(all_references)) {
    for (const ref of all_references) {
      if (ref.modifiers?.is_const_generic && ref.location) {
        const location_key_val = location_key(ref.location);

        // Try to resolve const generic from reference context
        const const_generic_type = resolve_const_generic_from_reference(
          ref,
          type_resolution,
          file_path
        );

        if (const_generic_type) {
          const_generic_types.set(location_key_val, const_generic_type);
        }
      }
    }
  }

  return const_generic_types;
}

/**
 * Resolve associated types from trait definitions and implementations
 */
export function resolve_associated_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const associated_type_map = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return associated_type_map;
  }

  // Process definitions to find associated types
  for (const [symbol_id, symbol] of index.symbols) {
    if (symbol.kind === 'type' &&
        symbol.modifiers?.is_associated_type &&
        symbol.location) {

      const location_key_val = location_key(symbol.location);

      // Resolve associated type based on context (trait vs impl)
      const associated_type = resolve_associated_type_from_symbol(
        symbol,
        type_resolution,
        index,
        file_path
      );

      if (associated_type) {
        associated_type_map.set(location_key_val, associated_type);
      }
    }
  }

  // Process references for associated type usage (e.g., Self::Item)
  const all_references = index.references?.all_references;
  if (all_references && Array.isArray(all_references)) {
    for (const ref of all_references) {
      if (ref.modifiers?.is_associated_type && ref.location) {
        const location_key_val = location_key(ref.location);

        const associated_type = resolve_associated_type_from_reference(
          ref,
          type_resolution,
          index,
          file_path
        );

        if (associated_type) {
          associated_type_map.set(location_key_val, associated_type);
        }
      }
    }
  }

  return associated_type_map;
}

/**
 * Resolve unsafe context information
 */
export function resolve_unsafe_contexts(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, { is_unsafe: boolean, unsafe_scope_kind: string }> {
  const unsafe_contexts = new Map<LocationKey, { is_unsafe: boolean, unsafe_scope_kind: string }>();

  if (!appears_to_be_rust_code(index)) {
    return unsafe_contexts;
  }

  // Process scopes to identify unsafe blocks and functions
  for (const [scope_id, scope] of index.scopes) {
    if (scope.modifiers?.is_unsafe && scope.location) {
      const location_key_val = location_key(scope.location);

      let unsafe_scope_kind = 'block';
      if (scope.entity === 'function') {
        unsafe_scope_kind = 'function';
      } else if (scope.entity === 'block') {
        unsafe_scope_kind = 'block';
      }

      unsafe_contexts.set(location_key_val, {
        is_unsafe: true,
        unsafe_scope_kind
      });
    }
  }

  return unsafe_contexts;
}

/**
 * Resolve loop constructs and their iterator types
 */
export function resolve_loop_constructs(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, { loop_type: string, iterator_type?: TypeId }> {
  const loop_constructs = new Map<LocationKey, { loop_type: string, iterator_type?: TypeId }>();

  if (!appears_to_be_rust_code(index)) {
    return loop_constructs;
  }

  // Process scopes to identify loop constructs
  for (const [scope_id, scope] of index.scopes) {
    if (scope.modifiers?.is_loop && scope.location) {
      const location_key_val = location_key(scope.location);

      const loop_type = scope.modifiers?.loop_type || 'loop';

      let iterator_type: TypeId | undefined;
      if (loop_type === 'for') {
        // Try to resolve the iterator type for for loops
        iterator_type = resolve_for_loop_iterator_type(scope, index, type_resolution);
      }

      loop_constructs.set(location_key_val, {
        loop_type,
        iterator_type
      });
    }
  }

  return loop_constructs;
}

// Helper functions

/**
 * Resolve const generic type from symbol definition
 */
function resolve_const_generic_type(
  symbol: any,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): TypeId | undefined {
  // Const generics typically have concrete types like usize, u32, bool, etc.
  // We would need to look at type annotations or infer from usage

  // For now, default to usize which is most common for const generics
  return create_builtin_type_id('usize');
}

/**
 * Resolve const generic from reference usage
 */
function resolve_const_generic_from_reference(
  ref: NormalizedCapture,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): TypeId | undefined {
  // Look for const generic usage in type parameters
  // This would analyze expressions like Array<T, N> where N is a const generic

  return create_builtin_type_id('usize');
}

/**
 * Resolve associated type from trait definition or impl
 */
function resolve_associated_type_from_symbol(
  symbol: any,
  type_resolution: TypeResolutionMap,
  index: SemanticIndex,
  file_path: FilePath
): TypeId | undefined {
  // If this is in an impl block, resolve to the concrete type
  if (symbol.modifiers?.is_trait_impl) {
    // Look for type alias in impl block that defines this associated type
    return resolve_impl_associated_type(symbol, index, type_resolution);
  }

  // If this is in a trait definition, create an abstract type
  return create_abstract_type_id(symbol.name);
}

/**
 * Resolve associated type from reference/usage
 */
function resolve_associated_type_from_reference(
  ref: NormalizedCapture,
  type_resolution: TypeResolutionMap,
  index: SemanticIndex,
  file_path: FilePath
): TypeId | undefined {
  // This handles cases like Self::Item, T::Output, etc.
  // Would need to analyze the qualified path to resolve the concrete type

  return create_abstract_type_id(ref.text || 'AssociatedType');
}

/**
 * Resolve concrete associated type from impl block
 */
function resolve_impl_associated_type(
  symbol: any,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the concrete type definition in the impl block
  // e.g., type Item = i32;

  // This would require analyzing the impl block structure
  // For now, return undefined to indicate it needs concrete resolution
  return undefined;
}

/**
 * Resolve iterator type for for loop constructs
 */
function resolve_for_loop_iterator_type(
  scope: any,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // For loops iterate over something that implements Iterator
  // We would need to find the iterable expression and resolve its type

  // This would require AST analysis to find the `in` expression
  return undefined;
}