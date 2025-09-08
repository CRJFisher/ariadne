/**
 * Rust Bespoke Interface Implementation Handler
 * 
 * Handles Rust-specific trait features:
 * - Associated types
 * - Associated constants
 * - Generic trait bounds
 * - Trait objects (dyn Trait)
 * - Default implementations
 * - Negative trait implementations
 * - Auto traits
 */

import { SyntaxNode } from 'tree-sitter';
import { InterfaceDefinition, MethodSignature, PropertySignature } from './types';

/**
 * Extract associated types from trait
 * 
 * Example: type Item;
 */
export function extract_associated_types(
  body_node: SyntaxNode,
  source_code: string
): PropertySignature[] {
  const associated_types: PropertySignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'associated_type') {
      const name_node = child.childForFieldName('name');
      const bounds_node = child.childForFieldName('bounds');
      
      if (name_node) {
        associated_types.push({
          name: source_code.substring(name_node.startIndex, name_node.endIndex),
          type: bounds_node 
            ? source_code.substring(bounds_node.startIndex, bounds_node.endIndex)
            : undefined,
          is_readonly: true
        });
      }
    }
  }
  
  return associated_types;
}

/**
 * Extract associated constants from trait
 * 
 * Example: const SIZE: usize;
 */
export function extract_associated_constants(
  body_node: SyntaxNode,
  source_code: string
): PropertySignature[] {
  const constants: PropertySignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'const_item') {
      const name_node = child.childForFieldName('name');
      const type_node = child.childForFieldName('type');
      
      if (name_node) {
        constants.push({
          name: source_code.substring(name_node.startIndex, name_node.endIndex),
          type: type_node 
            ? source_code.substring(type_node.startIndex, type_node.endIndex)
            : undefined,
          is_readonly: true,
          is_static: true
        });
      }
    }
  }
  
  return constants;
}

/**
 * Extract trait bounds from generic parameters
 * 
 * Example: trait Container<T: Display + Debug>
 */
export function extract_trait_bounds(
  trait_node: SyntaxNode,
  source_code: string
): Map<string, string[]> {
  const bounds = new Map<string, string[]>();
  const type_params = trait_node.childForFieldName('type_parameters');
  
  if (!type_params) return bounds;
  
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (!param) continue;
    
    if (param.type === 'type_parameter' || param.type === 'constrained_type_parameter') {
      const name_node = param.childForFieldName('name');
      const bounds_node = param.childForFieldName('bounds');
      
      if (name_node && bounds_node) {
        const param_name = source_code.substring(name_node.startIndex, name_node.endIndex);
        const param_bounds: string[] = [];
        
        // Extract individual bounds
        const traverse = (node: SyntaxNode) => {
          if (node.type === 'type_identifier' || node.type === 'scoped_type_identifier') {
            param_bounds.push(source_code.substring(node.startIndex, node.endIndex));
          }
          for (let j = 0; j < node.childCount; j++) {
            const child = node.child(j);
            if (child) traverse(child);
          }
        };
        
        traverse(bounds_node);
        if (param_bounds.length > 0) {
          bounds.set(param_name, param_bounds);
        }
      }
    }
  }
  
  return bounds;
}

/**
 * Check if trait has default implementations
 * 
 * Traits can provide default implementations for methods
 */
export function extract_default_implementations(
  body_node: SyntaxNode,
  source_code: string
): MethodSignature[] {
  const default_methods: MethodSignature[] = [];
  
  for (let i = 0; i < body_node.childCount; i++) {
    const child = body_node.child(i);
    if (!child) continue;
    
    if (child.type === 'function_item') {
      // Has a body means it has default implementation
      const body = child.childForFieldName('body');
      if (body) {
        const name_node = child.childForFieldName('name');
        if (name_node) {
          default_methods.push({
            name: source_code.substring(name_node.startIndex, name_node.endIndex),
            parameters: [], // TODO: Extract parameters
            is_abstract: false // Has implementation
          });
        }
      }
    }
  }
  
  return default_methods;
}

/**
 * Check if impl is negative (opt-out of trait)
 * 
 * Example: impl !Send for MyType
 */
export function is_negative_impl(
  impl_node: SyntaxNode,
  source_code: string
): boolean {
  // Look for '!' before trait name
  const trait_node = impl_node.childForFieldName('trait');
  if (!trait_node) return false;
  
  // Check if there's a '!' token before the trait
  for (let i = 0; i < impl_node.childCount; i++) {
    const child = impl_node.child(i);
    if (child === trait_node) break;
    
    if (child && child.type === '!') {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract where clauses from trait or impl
 * 
 * Example: where T: Display, U: Debug
 */
export function extract_where_clause(
  node: SyntaxNode,
  source_code: string
): Map<string, string[]> {
  const where_constraints = new Map<string, string[]>();
  const where_clause = node.childForFieldName('where_clause');
  
  if (!where_clause) return where_constraints;
  
  for (let i = 0; i < where_clause.childCount; i++) {
    const child = where_clause.child(i);
    if (!child) continue;
    
    if (child.type === 'where_predicate') {
      const type_node = child.childForFieldName('type');
      const bounds_node = child.childForFieldName('bounds');
      
      if (type_node && bounds_node) {
        const type_name = source_code.substring(type_node.startIndex, type_node.endIndex);
        const bounds: string[] = [];
        
        // Extract bounds
        const traverse = (node: SyntaxNode) => {
          if (node.type === 'type_identifier' || node.type === 'scoped_type_identifier') {
            bounds.push(source_code.substring(node.startIndex, node.endIndex));
          }
          for (let j = 0; j < node.childCount; j++) {
            const c = node.child(j);
            if (c) traverse(c);
          }
        };
        
        traverse(bounds_node);
        if (bounds.length > 0) {
          where_constraints.set(type_name, bounds);
        }
      }
    }
  }
  
  return where_constraints;
}

/**
 * Check if trait is marked as unsafe
 * 
 * Example: unsafe trait Send
 */
export function is_unsafe_trait(
  trait_node: SyntaxNode,
  source_code: string
): boolean {
  // Check for 'unsafe' keyword before 'trait'
  for (let i = 0; i < trait_node.childCount; i++) {
    const child = trait_node.child(i);
    if (child && child.type === 'unsafe') {
      return true;
    }
    if (child && child.type === 'trait') {
      break; // Stop after reaching 'trait' keyword
    }
  }
  
  return false;
}

/**
 * Extract supertraits (trait inheritance)
 * 
 * Example: trait MyTrait: Display + Debug
 */
export function extract_supertraits(
  trait_node: SyntaxNode,
  source_code: string
): string[] {
  const supertraits: string[] = [];
  const bounds_node = trait_node.childForFieldName('bounds');
  
  if (!bounds_node) return supertraits;
  
  const traverse = (node: SyntaxNode) => {
    if (node.type === 'type_identifier' || node.type === 'scoped_type_identifier') {
      supertraits.push(source_code.substring(node.startIndex, node.endIndex));
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  };
  
  traverse(bounds_node);
  return supertraits;
}

/**
 * Check if impl block is for a generic type
 * 
 * Example: impl<T> MyTrait for Vec<T>
 */
export function is_generic_impl(
  impl_node: SyntaxNode
): boolean {
  const type_params = impl_node.childForFieldName('type_parameters');
  return type_params !== null && type_params.childCount > 0;
}

/**
 * Extract lifetime parameters from trait
 * 
 * Example: trait MyTrait<'a, 'b: 'a>
 */
export function extract_lifetime_parameters(
  trait_node: SyntaxNode,
  source_code: string
): string[] {
  const lifetimes: string[] = [];
  const type_params = trait_node.childForFieldName('type_parameters');
  
  if (!type_params) return lifetimes;
  
  for (let i = 0; i < type_params.childCount; i++) {
    const param = type_params.child(i);
    if (!param) continue;
    
    if (param.type === 'lifetime') {
      lifetimes.push(source_code.substring(param.startIndex, param.endIndex));
    }
  }
  
  return lifetimes;
}