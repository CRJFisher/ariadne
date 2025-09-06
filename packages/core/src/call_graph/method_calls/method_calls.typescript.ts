/**
 * TypeScript bespoke method call features
 * 
 * Handles TypeScript-specific patterns:
 * - Generic method calls with type arguments
 * - Type assertions in method calls
 * 
 * Note: Abstract and interface method detection would require full type information,
 * which is not available in per-file analysis.
 */

import { SyntaxNode } from 'tree-sitter';
import { MethodCallInfo } from '@ariadnejs/types';

/**
 * Extract type arguments from a generic method call
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

/**
 * Check if a method call has type arguments
 */
export function has_type_arguments(
  node: SyntaxNode
): boolean {
  if (node.type !== 'call_expression') {
    return false;
  }
  
  return node.childForFieldName('type_arguments') !== null;
}

/**
 * Enhance method call info with TypeScript-specific features
 */
export function enhance_typescript_method_call(
  base_info: MethodCallInfo,
  node: SyntaxNode,
  source: string
): MethodCallInfo {
  // Add type arguments if present
  if (has_type_arguments(node)) {
    const type_args = extract_type_arguments(node, source);
    return {
      ...base_info,
      type_arguments: type_args
    };
  }
  
  return base_info;
}

/**
 * Find TypeScript bespoke method calls
 * 
 * Currently, TypeScript doesn't have many truly unique patterns that
 * can't be handled by the generic processor. Type arguments are added
 * as enrichment rather than requiring separate detection.
 */
export function find_typescript_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null {
  // TypeScript-specific patterns would go here
  // Currently, most TypeScript features are enhancements to existing calls
  // rather than completely different patterns
  return null;
}