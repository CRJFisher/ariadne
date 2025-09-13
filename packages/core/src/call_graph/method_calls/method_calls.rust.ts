/**
 * Rust bespoke method call features
 * 
 * Handles Rust-specific patterns:
 * - Trait method calls (UFCS syntax)
 * - Unsafe method calls
 * - Turbofish syntax (::<Type>)
 * - Method calls on references
 * - Impl trait context
 */

import { SyntaxNode } from 'tree-sitter';
import { MethodCallInfo } from '@ariadnejs/types';

/**
 * Detect trait method calls (UFCS: <Type as Trait>::method)
 */
export function detect_trait_method_call(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func) return null;
  
  // UFCS pattern: <Type as Trait>::method
  // The function field has type 'scoped_identifier' for UFCS
  if (func.type === 'scoped_identifier') {
    // Check for bracketed_type child which contains <Type as Trait>
    let bracketed_type = null;
    for (let i = 0; i < func.childCount; i++) {
      const child = func.child(i);
      if (child && child.type === 'bracketed_type') {
        bracketed_type = child;
        break;
      }
    }
    
    if (bracketed_type) {
      // Extract the full UFCS text and parse it
      const method_text = source.substring(func.startIndex, func.endIndex);
      
      // Parse pattern like "<String as Display>::fmt"
      const match = method_text.match(/<(.+?)\s+as\s+(.+?)>::(.+)/);
      if (match) {
        const [, type_name, trait_name, method_name] = match;
        
        return {
          caller_name: '<module>',
          method_name,
          receiver_name: `<${type_name} as ${trait_name}>`,
          location: {
            line: node.startPosition.row,
            column: node.startPosition.column
          },
          is_static_method: true,
          is_chained_call: false,
          arguments_count: count_arguments(node),
          trait_impl: trait_name,
          impl_type: type_name
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if method call is in unsafe block
 */
export function is_in_unsafe_block(
  node: SyntaxNode
): boolean {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'unsafe_block') {
      return true;
    }
    current = current.parent;
  }
  
  return false;
}

/**
 * Extract turbofish type parameters
 */
export function extract_turbofish_types(
  node: SyntaxNode,
  source: string
): string[] | null {
  const func = node.childForFieldName('function');
  if (!func) return null;
  
  // Check if function is directly a generic_function (turbofish pattern)
  if (func.type === 'generic_function') {
    // Extract type parameters from the function text
    const func_text = source.substring(func.startIndex, func.endIndex);
    const match = func_text.match(/::<(.+?)>$/);
    if (match) {
      const type_list = match[1];
      // Split by comma and clean up
      const types = type_list.split(',').map(t => t.trim());
      return types.length > 0 ? types : null;
    }
  }
  
  // Alternative: field_expression with generic_function field
  if (func.type === 'field_expression') {
    const field = func.childForFieldName('field');
    if (field && field.type === 'generic_function') {
      const type_args = field.childForFieldName('type_arguments');
      if (type_args) {
        const types: string[] = [];
        for (let i = 0; i < type_args.childCount; i++) {
          const child = type_args.child(i);
          if (child && 
              child.type !== ':' && 
              child.type !== '<' && 
              child.type !== '>' && 
              child.type !== ',') {
            types.push(source.substring(child.startIndex, child.endIndex));
          }
        }
        return types.length > 0 ? types : null;
      }
    }
  }
  
  return null;
}

/**
 * Get impl trait context
 */
export function get_impl_trait_context(
  node: SyntaxNode,
  source: string
): { type_name: string; trait_name: string } | null {
  if (!node.parent) {
    return null;
  }
  
  let current: SyntaxNode | null = node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      const type_node = current.childForFieldName('type');
      const trait_node = current.childForFieldName('trait');
      
      if (type_node) {
        const type_name = source.substring(type_node.startIndex, type_node.endIndex);
        const trait_name = trait_node ? 
          source.substring(trait_node.startIndex, trait_node.endIndex) : null;
        
        return {
          type_name,
          trait_name: trait_name || ''
        };
      }
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Enhance method call with Rust-specific information
 */
export function enhance_rust_method_call(
  base_info: MethodCallInfo,
  node: SyntaxNode,
  source: string
): MethodCallInfo {
  let enhanced = { ...base_info };
  
  // Check if in unsafe block
  if (is_in_unsafe_block(node)) {
    enhanced.is_unsafe = true;
  }
  
  // Check for turbofish
  const turbofish_types = extract_turbofish_types(node, source);
  if (turbofish_types) {
    enhanced.turbofish_types = turbofish_types;
  }
  
  // Get impl trait context
  const impl_context = get_impl_trait_context(node, source);
  if (impl_context && impl_context.trait_name) {
    enhanced.trait_impl = impl_context.trait_name;
    enhanced.impl_type = impl_context.type_name;
  }
  
  // Check if receiver is a reference
  const func = node.childForFieldName('function');
  if (func?.type === 'field_expression') {
    const value = func.childForFieldName('value');
    if (value) {
      const value_text = source.substring(value.startIndex, value.endIndex);

      // Check if the receiver starts with & (reference)
      if (value_text.startsWith('(&')) {
        enhanced.is_ref_method = true;
        // Check if it's a mutable reference
        enhanced.is_mut_ref = value_text.startsWith('(&mut');
      }
      // Direct reference without parentheses
      else if (value_text.startsWith('&')) {
        enhanced.is_ref_method = true;
        enhanced.is_mut_ref = value_text.startsWith('&mut');
      }
    }
  }
  
  return enhanced;
}

/**
 * Helper to count arguments
 */
function count_arguments(node: SyntaxNode): number {
  const args = node.childForFieldName('arguments');
  if (!args) return 0;
  
  let count = 0;
  for (let i = 0; i < args.childCount; i++) {
    const child = args.child(i);
    if (child && 
        child.type !== '(' && 
        child.type !== ')' && 
        child.type !== ',' && 
        child.type !== 'comment') {
      count++;
    }
  }
  
  return count;
}

/**
 * Find Rust bespoke method calls
 */
export function find_rust_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  // Try trait method calls (UFCS)
  return detect_trait_method_call(node, source);
}