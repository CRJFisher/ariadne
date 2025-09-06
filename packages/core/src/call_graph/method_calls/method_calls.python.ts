/**
 * Python bespoke method call features
 * 
 * Handles Python-specific patterns:
 * - super() method calls
 * - Dunder/magic method detection
 * - Classmethod vs staticmethod distinction
 */

import { SyntaxNode } from 'tree-sitter';
import { MethodCallInfo } from '@ariadnejs/types';

/**
 * Detect super() method calls
 */
export function detect_super_method_call(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  if (node.type !== 'call') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'attribute') {
    return null;
  }
  
  const object = func.childForFieldName('object');
  const attr = func.childForFieldName('attribute');
  
  if (!object || !attr || object.type !== 'call') {
    return null;
  }
  
  // Check if the object is a super() call
  const super_func = object.childForFieldName('function');
  if (super_func && super_func.type === 'identifier') {
    const name = source.substring(super_func.startIndex, super_func.endIndex);
    if (name === 'super') {
      const method_name = source.substring(attr.startIndex, attr.endIndex);
      
      return {
        caller_name: '<module>',
        method_name,
        receiver_name: 'super()',
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        is_static_method: false,
        is_chained_call: false,
        arguments_count: count_arguments(node),
        is_super_call: true  // Mark as super call
      };
    }
  }
  
  return null;
}

/**
 * Check if a method is a dunder/magic method
 */
export function is_dunder_method(
  method_name: string
): boolean {
  return method_name.startsWith('__') && method_name.endsWith('__');
}

/**
 * Enhance method call with Python-specific information
 */
export function enhance_python_method_call(
  base_info: MethodCallInfo,
  node: SyntaxNode,
  source: string
): MethodCallInfo {
  // Check if it's a dunder method
  if (is_dunder_method(base_info.method_name)) {
    return {
      ...base_info,
      is_magic_method: true
    };
  }
  
  // Check for cls receiver (classmethod)
  if (base_info.receiver_name === 'cls') {
    return {
      ...base_info,
      is_classmethod: true,
      is_static_method: true  // Classmethod is a form of static method
    };
  }
  
  return base_info;
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
 * Find Python bespoke method calls
 */
export function find_python_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  // Try super() method calls
  return detect_super_method_call(node, source);
}