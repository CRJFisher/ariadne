/**
 * Python bespoke member access handlers
 * 
 * Handles language-specific features that cannot be expressed through configuration:
 * - getattr() dynamic attribute access
 */

import type { SyntaxNode } from 'tree-sitter';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { node_to_location } from '../node_utils';
import { NamespaceName } from '@ariadnejs/types';

/**
 * Handle Python getattr() calls for dynamic attribute access
 * 
 * @example
 * // getattr(obj, 'property')
 * // getattr(module, 'function', default_value)
 */
export function handle_python_getattr(
  node: SyntaxNode,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Check for call expression
  if (node.type !== 'call') {
    return null;
  }
  
  const function_node = node.childForFieldName('function');
  const arguments_node = node.childForFieldName('arguments');
  
  if (!function_node || !arguments_node) {
    return null;
  }
  
  // Check if the function is 'getattr'
  if (function_node.text !== 'getattr') {
    return null;
  }
  
  // Parse arguments to getattr(obj, attr_name, [default])
  const args = arguments_node.namedChildren.filter(
    child => child.type !== ',' && child.type !== '('  && child.type !== ')'
  );
  
  if (args.length < 2) {
    return null;  // getattr requires at least 2 arguments
  }
  
  const object_arg = args[0];
  const attr_arg = args[1];
  
  const object_name = object_arg.text;
  
  // Check if the object is a known namespace import
  if (!context.namespace_imports.has(object_name as NamespaceName)) {
    return null;
  }
  
  // Extract attribute name (remove quotes if string literal)
  let attr_name: string;
  if (attr_arg.type === 'string') {
    // Remove quotes from string literal
    attr_name = attr_arg.text.slice(1, -1);
  } else {
    // For dynamic expressions, use the raw text
    attr_name = `getattr(${attr_arg.text})`;
  }
  
  return {
    namespace: object_name as NamespaceName,
    member: attr_name,
    location: node_to_location(node, context.file_path)
  };
}