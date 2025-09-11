/**
 * Rust-specific bespoke generic features
 * 
 * Handles Rust lifetime parameters, associated types, and trait bounds
 */

import { ResolvedGeneric } from '@ariadnejs/types';
import { GenericContext, resolve_generic_type } from './generic_resolution';

/**
 * Resolve type parameters in Rust trait bounds
 * e.g., "T" -> "Display", "T + U" -> "Clone + Send"
 */
function resolve_rust_trait_bounds(trait_bounds: string, context?: GenericContext): string {
  if (!context) return trait_bounds;
  
  let resolved = trait_bounds;
  context.type_arguments.forEach((replacement, param) => {
    // Use word boundaries to ensure we only replace complete type parameters
    const regex = new RegExp(`\\b${param}\\b`, 'g');
    resolved = resolved.replace(regex, replacement);
  });
  
  return resolved;
}

// =============================================================================
// PUBLIC API FUNCTIONS (in order of usage by main module)
// =============================================================================

/**
 * Resolve Rust associated types
 * e.g., T::Item, Self::Output
 */
export function resolve_rust_associated_type(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  if (!type_ref.includes('::')) return null;
  
  const parts = type_ref.split('::');
  if (parts.length < 2) return null;
  
  const base_type = parts[0];
  const associated = parts.slice(1).join('::');
  
  // Resolve the base type first
  const base_resolved = resolve_generic_type(base_type, context);
  
  // Build the resolved associated type
  const resolved_type = base_resolved.resolved_type !== base_type
    ? `${base_resolved.resolved_type}::${associated}`
    : type_ref;
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions: base_resolved.type_substitutions,
    confidence: base_resolved.confidence
  };
}

/**
 * Handle Rust impl Trait syntax
 * This is Rust's way of specifying anonymous types with trait bounds
 */
export function resolve_rust_impl_trait(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const impl_match = type_ref.match(/^impl\s+(.+)$/);
  if (!impl_match) return null;
  
  const trait_bounds = impl_match[1];
  const resolved_bounds = resolve_rust_trait_bounds(trait_bounds, context);
  
  return {
    original_type: type_ref,
    resolved_type: `impl ${resolved_bounds}`,
    type_substitutions: new Map(),
    confidence: 'partial'
  };
}

/**
 * Handle Rust dyn Trait syntax
 * Dynamic dispatch through trait objects
 */
export function resolve_rust_dyn_trait(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const dyn_match = type_ref.match(/^dyn\s+(.+)$/);
  if (!dyn_match) return null;
  
  const trait_bounds = dyn_match[1];
  const resolved_bounds = resolve_rust_trait_bounds(trait_bounds, context);
  
  return {
    original_type: type_ref,
    resolved_type: `dyn ${resolved_bounds}`,
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

/**
 * Handle Rust references with lifetimes
 * e.g., &'a str, &'static mut T
 */
export function resolve_rust_reference(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const ref_match = type_ref.match(/^&('?\w*\s+)?(mut\s+)?(.+)$/);
  if (!ref_match) return null;
  
  const [_, lifetime, mutability, inner_type] = ref_match;
  
  // Resolve the inner type
  const inner_resolved = resolve_generic_type(inner_type, context);
  
  // Reconstruct the reference
  const lifetime_str = lifetime ? lifetime.trim() + ' ' : '';
  const mut_str = mutability ? 'mut ' : '';
  const resolved_type = `&${lifetime_str}${mut_str}${inner_resolved.resolved_type}`;
  
  return {
    original_type: type_ref,
    resolved_type,
    type_substitutions: inner_resolved.type_substitutions,
    confidence: inner_resolved.confidence
  };
}

/**
 * Handle Rust tuple types
 * e.g., (T, U), (i32, String, bool)
 */
export function resolve_rust_tuple(
  type_ref: string,
  context: GenericContext
): ResolvedGeneric | null {
  const tuple_match = type_ref.match(/^\((.+)\)$/);
  if (!tuple_match) return null;
  
  const elements = tuple_match[1].split(',').map(e => e.trim());
  const resolved_elements = elements.map(elem => {
    const resolved = resolve_generic_type(elem, context);
    return resolved.resolved_type;
  });
  
  return {
    original_type: type_ref,
    resolved_type: `(${resolved_elements.join(', ')})`,
    type_substitutions: new Map(),
    confidence: 'exact'
  };
}

/**
 * Check if a Rust type has lifetime parameters
 */
export function has_lifetime_parameters(type_ref: string): boolean {
  return /'[a-z]+/.test(type_ref);
}

/**
 * Strip lifetime parameters from a Rust type
 * Used when lifetimes don't affect type resolution
 */
export function strip_rust_lifetimes(type_ref: string): string {
  // Remove lifetime annotations like 'a, 'static, etc.
  return type_ref.replace(/'[a-z]+/g, '').replace(/\s+/g, ' ').trim();
}

// =============================================================================
// UTILITY FUNCTIONS (helper functions and not used by main module)
// =============================================================================

/**
 * Extract lifetime parameters from Rust type
 * Lifetimes are unique to Rust's ownership system
 */
export function extract_rust_lifetimes(type_ref: string): string[] {
  const lifetimes: string[] = [];
  const lifetime_regex = /'([a-z]+)/g;
  let match;
  
  while ((match = lifetime_regex.exec(type_ref)) !== null) {
    lifetimes.push(match[1]);
  }
  
  return lifetimes;
}

