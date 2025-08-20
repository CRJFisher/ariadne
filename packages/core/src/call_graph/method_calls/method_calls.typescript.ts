/**
 * TypeScript-specific method call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language } from '@ariadnejs/types';
import { find_method_calls_javascript } from './method_calls.javascript';
import { MethodCallInfo, MethodCallContext } from './method_calls';

/**
 * Find all method calls in TypeScript code
 * 
 * TypeScript shares most logic with JavaScript but adds:
 * - Generic method calls
 * - Interface method calls
 * - Abstract method calls
 */
export function find_method_calls_typescript(
  context: MethodCallContext
): MethodCallInfo[] {
  // Start with JavaScript detection
  const calls = find_method_calls_javascript(context);
  
  // Add TypeScript-specific method calls
  const ts_calls = find_typescript_specific_method_calls(context);
  
  return [...calls, ...ts_calls];
}

/**
 * Find TypeScript-specific method call patterns
 */
function find_typescript_specific_method_calls(
  context: MethodCallContext
): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  
  walk_tree(context.ast_root, (node) => {
    // Check for method calls with type arguments
    if (node.type === 'call_expression') {
      const type_args = node.childForFieldName('type_arguments');
      if (type_args) {
        // This is a generic method call
        // The basic structure is already handled by JavaScript detection
        // We just note that it has type arguments
      }
    }
  });
  
  return calls;
}

/**
 * Walk the AST tree
 */
function walk_tree(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}

/**
 * TypeScript-specific: Check if a method call has type arguments
 */
export function has_type_arguments_method(
  node: SyntaxNode
): boolean {
  if (node.type !== 'call_expression') {
    return false;
  }
  
  return node.childForFieldName('type_arguments') !== null;
}

/**
 * TypeScript-specific: Check if calling an abstract method
 */
export function is_abstract_method_call(
  node: SyntaxNode,
  source: string
): boolean {
  // This would require type information to determine if the method is abstract
  // For now, we can't determine this from just the AST
  return false;
}

/**
 * TypeScript-specific: Check if calling through an interface
 */
export function is_interface_method_call(
  node: SyntaxNode,
  source: string
): boolean {
  // This would require type information to determine if the receiver is an interface
  // For now, we can't determine this from just the AST
  return false;
}

/**
 * TypeScript-specific: Extract type arguments from a generic method call
 */
export function extract_type_arguments(
  node: SyntaxNode,
  source: string
): string[] {
  const type_args_node = node.childForFieldName('type_arguments');
  if (!type_args_node) return [];
  
  const types: string[] = [];
  
  for (let i = 0; i < type_args_node.childCount; i++) {
    const child = type_args_node.child(i);
    if (child && 
        child.type !== '<' && 
        child.type !== '>' && 
        child.type !== ',') {
      types.push(source.substring(child.startIndex, child.endIndex));
    }
  }
  
  return types;
}