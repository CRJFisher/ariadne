/**
 * JavaScript-specific bespoke constructor call features
 * 
 * This module handles JavaScript-specific constructor patterns that
 * cannot be expressed through configuration alone.
 */

import { SyntaxNode } from 'tree-sitter';
import { ConstructorCall as ConstructorCallInfo } from '@ariadnejs/types';
import { ConstructorCallContext } from './constructor_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle JavaScript's Object.create() pattern
 * 
 * Object.create() is a special constructor pattern in JavaScript
 * that creates a new object with the specified prototype.
 */
export function handle_object_create_pattern(
  node: SyntaxNode,
  context: ConstructorCallContext
): ConstructorCallInfo | null {
  if (node.type !== 'call_expression') return null;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') return null;
  
  const object = func.childForFieldName('object');
  const property = func.childForFieldName('property');
  
  if (!object || !property) return null;
  
  const obj_name = context.source_code.substring(object.startIndex, object.endIndex);
  const prop_name = context.source_code.substring(property.startIndex, property.endIndex);
  
  if (obj_name !== 'Object' || prop_name !== 'create') return null;
  
  // Extract the prototype argument to determine the "type"
  const args = node.childForFieldName('arguments');
  if (!args || args.childCount < 2) return null; // Need at least one argument
  
  // Find the first non-punctuation child (the prototype argument)
  let proto_arg: SyntaxNode | null = null;
  for (let i = 0; i < args.childCount; i++) {
    const child = args.child(i);
    if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
      proto_arg = child;
      break;
    }
  }
  
  if (!proto_arg) return null;
  
  // Try to extract a meaningful name from the prototype
  let constructor_name = 'Object';
  if (proto_arg.type === 'member_expression') {
    const prop = proto_arg.childForFieldName('property');
    if (prop && prop.text === 'prototype') {
      const obj = proto_arg.childForFieldName('object');
      if (obj) {
        constructor_name = context.source_code.substring(obj.startIndex, obj.endIndex);
      }
    }
  }
  
  // Find assignment target
  let assigned_to: string | undefined;
  let current = node.parent;
  while (current) {
    if (current.type === 'variable_declarator') {
      const name = current.childForFieldName('name');
      if (name && name.type === 'identifier') {
        assigned_to = context.source_code.substring(name.startIndex, name.endIndex);
        break;
      }
    }
    if (current.type === 'expression_statement') break;
    current = current.parent;
  }
  
  return {
    constructor_name,
    location: node_to_location(node, context.file_path),
    arguments_count: 1, // Object.create typically takes 1-2 arguments
    assigned_to,
    is_new_expression: false,
    is_factory_method: true // Object.create is essentially a factory
  };
}

/**
 * Handle class extends pattern for inheritance tracking
 * 
 * While not a constructor call per se, class inheritance is related
 * to constructor behavior and type relationships.
 */
export function extract_class_inheritance(
  node: SyntaxNode,
  context: ConstructorCallContext
): { child_class: string; parent_class: string } | null {
  if (node.type !== 'class_declaration' && node.type !== 'class') {
    return null;
  }
  
  const name = node.childForFieldName('name');
  if (!name) return null;
  
  // Find the class_heritage node which contains the extends clause
  let heritage: SyntaxNode | null = null;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'class_heritage') {
      heritage = child;
      break;
    }
  }
  
  if (!heritage) return null;
  
  // Find the parent class identifier in the heritage node
  let parent_identifier: SyntaxNode | null = null;
  for (let i = 0; i < heritage.childCount; i++) {
    const child = heritage.child(i);
    if (child && child.type === 'identifier') {
      parent_identifier = child;
      break;
    }
  }
  
  if (!parent_identifier) return null;
  
  const child_class = context.source_code.substring(name.startIndex, name.endIndex);
  const parent_class = context.source_code.substring(parent_identifier.startIndex, parent_identifier.endIndex);
  
  return { child_class, parent_class };
}

/**
 * Detect factory function patterns beyond simple capitalization
 * 
 * Some JavaScript code uses factory functions with specific patterns
 * like returning object literals or using closures.
 */
export function detect_advanced_factory_pattern(
  node: SyntaxNode,
  context: ConstructorCallContext
): boolean {
  if (node.type !== 'call_expression') return false;
  
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'identifier') return false;
  
  const func_name = context.source_code.substring(func.startIndex, func.endIndex);
  
  // Check for common factory function prefixes
  const factory_prefixes = ['create', 'make', 'build', 'construct'];
  const lower_name = func_name.toLowerCase();
  
  return factory_prefixes.some(prefix => lower_name.startsWith(prefix));
}