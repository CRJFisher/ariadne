/**
 * Rust-specific generic type resolution
 * 
 * Handles Rust generics, lifetimes, trait bounds, and associated types
 */

import { SyntaxNode } from 'tree-sitter';
import {
  GenericParameter,
  GenericContext,
  ResolvedGeneric,
  resolve_generic_type
} from './generic_resolution';

/**
 * Extract Rust generic parameters from AST node
 */
export function extract_rust_generics(
  node: SyntaxNode,
  source_code: string
): GenericParameter[] {
  const params: GenericParameter[] = [];
  
  // Look for type_parameters or generic_parameters
  const type_params = node.childForFieldName('type_parameters') || 
                     node.childForFieldName('generic_parameters');
  if (!type_params) return params;
  
  // Iterate through parameters
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    
    if (param?.type === 'type_identifier' || param?.type === 'generic_type') {
      const name = source_code.substring(param.startIndex, param.endIndex);
      
      // Look for bounds (e.g., T: Clone + Debug)
      const next = type_params.child(i + 1);
      let constraint: string | undefined;
      
      if (next?.type === ':') {
        let bound_end = i + 2;
        const bounds: string[] = [];
        
        while (bound_end < type_params.childCount) {
          const bound = type_params.child(bound_end);
          if (bound?.type === ',') break;
          if (bound?.type === 'type_identifier' || bound?.type === 'trait_bound') {
            bounds.push(source_code.substring(bound.startIndex, bound.endIndex));
          }
          bound_end++;
        }
        
        if (bounds.length > 0) {
          constraint = bounds.join(' + ');
        }
      }
      
      params.push({ name, constraint });
    }
  }
  
  return params;
}

/**
 * Rust-specific generic resolution with lifetime and trait handling
 */
export function resolve_rust_generic(
  type_ref: string,
  context: GenericContext,
  type_registry?: Map<string, any>
): ResolvedGeneric {
  // Handle Rust-specific patterns like lifetimes
  let cleaned_ref = type_ref.replace(/'[a-z]+/g, ''); // Remove lifetime annotations
  
  // Handle associated types (e.g., T::Item)
  if (cleaned_ref.includes('::')) {
    const parts = cleaned_ref.split('::');
    const base = parts[0];
    
    // Resolve the base type first
    const base_resolved = resolve_generic_type(base, context);
    if (base_resolved.resolved_type !== base) {
      cleaned_ref = cleaned_ref.replace(base, base_resolved.resolved_type);
    }
  }
  
  return resolve_generic_type(cleaned_ref, context);
}

/**
 * Check if a type name is a Rust generic parameter
 */
export function is_rust_generic(type_name: string): boolean {
  // Single uppercase letters are typically generic parameters
  if (/^[A-Z]$/.test(type_name)) return true;
  
  // Common Rust generic parameter patterns
  const generic_patterns = [
    /^T[A-Z]?.*$/,     // T, TKey, TValue, etc.
    /^'[a-z]+$/,       // Lifetime parameters like 'a, 'static
    /^impl\s+/,        // impl Trait syntax
  ];
  
  return generic_patterns.some(pattern => pattern.test(type_name));
}

/**
 * Extract lifetime parameters from Rust type
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

/**
 * Check if a Rust type has lifetime parameters
 */
export function has_lifetime_parameters(type_ref: string): boolean {
  return /'[a-z]+/.test(type_ref);
}