/**
 * Rust bespoke member access handlers
 * 
 * Handles language-specific features that cannot be expressed through configuration:
 * - Field expressions (struct.field) that are not namespace accesses
 */

import type { SyntaxNode } from 'tree-sitter';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { node_to_location } from '../node_utils';
import { NamespaceName } from '@ariadnejs/types';

/**
 * Handle Rust field expressions (struct.field)
 * 
 * Note: This only handles field access on namespace imports.
 * Regular struct field access is not a namespace member access.
 * 
 * @example
 * // module.struct_instance.field  (if module is a namespace)
 * // crate::module.function()       (handled by config via scoped_identifier)
 */
export function handle_rust_field_expression(
  node: SyntaxNode,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Check for field expression
  if (node.type !== 'field_expression') {
    return null;
  }
  
  const value_node = node.childForFieldName('value');
  const field_node = node.childForFieldName('field');
  
  if (!value_node || !field_node) {
    return null;
  }
  
  const value_name = value_node.text;
  const field_name = field_node.text;
  
  // Check if the value is a known namespace import
  // This is rare in Rust but possible with certain module patterns
  if (!context.namespace_imports.has(value_name as NamespaceName)) {
    return null;
  }
  
  return {
    namespace: value_name as NamespaceName,
    member: field_name,
    location: node_to_location(node, context.file_path)
  };
}