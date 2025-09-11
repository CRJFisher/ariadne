/**
 * JavaScript/TypeScript bespoke member access handlers
 * 
 * Handles language-specific features that cannot be expressed through configuration:
 * - Optional chaining (?.)
 * - Computed property access ([])
 */

import type { SyntaxNode } from 'tree-sitter';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { node_to_location } from '../node_utils';
import { NamespaceName } from '@ariadnejs/types';

/**
 * Handle JavaScript optional chaining (?.property)
 * 
 * @example
 * // obj?.property
 * // array?.[0]
 * // func?.()
 */
export function handle_javascript_optional_chaining(
  node: SyntaxNode,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Check for optional member expression
  if (node.type !== 'member_expression') {
    return null;
  }
  
  // Check if it has the optional operator
  const optional_operator = node.childForFieldName('optional_chain');
  if (!optional_operator || optional_operator.text !== '?.') {
    return null;
  }
  
  const object_node = node.childForFieldName('object');
  const property_node = node.childForFieldName('property');
  
  if (!object_node || !property_node) {
    return null;
  }
  
  const object_name = object_node.text;
  const property_name = property_node.text;
  
  // Check if the object is a known namespace import
  if (!context.namespace_imports.has(object_name as NamespaceName)) {
    return null;
  }
  
  return {
    namespace: object_name as NamespaceName,
    member: property_name,
    location: node_to_location(node, context.file_path)
  };
}

/**
 * Handle JavaScript computed property access (obj[prop])
 * 
 * @example
 * // obj['property']
 * // obj[variable]
 * // obj[0]
 */
export function handle_javascript_computed_access(
  node: SyntaxNode,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Check for subscript expression
  if (node.type !== 'subscript_expression') {
    return null;
  }
  
  const object_node = node.childForFieldName('object');
  const index_node = node.childForFieldName('index');
  
  if (!object_node || !index_node) {
    return null;
  }
  
  const object_name = object_node.text;
  
  // Check if the object is a known namespace import
  if (!context.namespace_imports.has(object_name as NamespaceName)) {
    return null;
  }
  
  // For computed access, try to extract the member name if it's a string literal
  let member_name: string;
  if (index_node.type === 'string') {
    // Remove quotes from string literal
    member_name = index_node.text.slice(1, -1);
  } else {
    // For dynamic expressions, use the raw text
    member_name = `[${index_node.text}]`;
  }
  
  return {
    namespace: object_name as NamespaceName,
    member: member_name,
    location: node_to_location(node, context.file_path)
  };
}