/**
 * JavaScript/TypeScript-specific bespoke handlers for class hierarchy
 * 
 * Handles JavaScript and TypeScript-specific features that cannot be
 * expressed through configuration:
 * - Complex interface extension patterns
 * - Mixin patterns
 * - Decorator-based inheritance
 */

import { SyntaxNode } from 'tree-sitter';
import {
  ClassNode,
  ClassDefinition,
  FilePath
} from '@ariadnejs/types';
import {
  BespokeHandlers,
  ClassHierarchyContext
} from './class_hierarchy';
import { AnyLocationFormat, extractTargetPosition } from '../../ast/location_utils';

/**
 * Create JavaScript bespoke handlers
 */
export function create_javascript_handlers(): BespokeHandlers {
  return {
    post_process_node: post_process_javascript_node
  };
}

/**
 * Create TypeScript bespoke handlers
 */
export function create_typescript_handlers(): BespokeHandlers {
  return {
    post_process_node: post_process_typescript_node
  };
}

/**
 * Post-process JavaScript class node
 */
function post_process_javascript_node(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Check for mixin patterns
  detect_mixin_pattern(node, def, context);
}

/**
 * Post-process TypeScript class node
 */
function post_process_typescript_node(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // JavaScript processing applies
  post_process_javascript_node(node, def, context);
  
  // Check for decorator-based patterns
  detect_decorator_inheritance(node, def, context);
  
  // Handle abstract classes
  if (def.is_abstract === undefined) {
    detect_abstract_class(node, def, context);
  }
}

/**
 * Detect mixin patterns in JavaScript/TypeScript
 */
function detect_mixin_pattern(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  // Look for common mixin patterns
  // e.g., class extends mixin(Base)
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Find the class declaration node
  let class_node = ast_node;
  while (class_node && 
         class_node.type !== 'class_declaration' && 
         class_node.type !== 'abstract_class_declaration') {
    class_node = class_node.parent;
  }
  
  if (!class_node) return;
  
  // Find class_heritage
  const heritage = find_child_by_type(class_node, 'class_heritage');
  if (!heritage) return;
  
  // Check if extends uses a call expression (mixin pattern)
  // Need to check recursively as call_expression might be nested
  function hasCallExpression(node: SyntaxNode): boolean {
    if (node.type === 'call_expression') {
      return true;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && hasCallExpression(child)) {
        return true;
      }
    }
    return false;
  }
  
  if (hasCallExpression(heritage)) {
    (node as any).is_mixin = true;
  }
}

/**
 * Detect decorator-based inheritance in TypeScript
 */
function detect_decorator_inheritance(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Look for decorators
  let current = ast_node;
  while (current && current.type !== 'class_declaration') {
    current = current.parent;
  }
  
  if (!current) return;
  
  // Check for decorators before the class
  let prev = current.previousSibling;
  while (prev) {
    if (prev.type === 'decorator') {
      const decorator_name = extract_decorator_name(prev, context.source_code);
      
      // Check for common inheritance decorators
      if (decorator_name && is_inheritance_decorator(decorator_name)) {
        // Add as a special interface
        if (!node.interfaces) {
          (node as any).interfaces = [];
        }
        (node.interfaces as string[]).push(`@${decorator_name}`);
      }
    }
    prev = prev.previousSibling;
  }
}

/**
 * Detect abstract class in TypeScript
 */
function detect_abstract_class(
  node: ClassNode,
  def: ClassDefinition,
  context: ClassHierarchyContext
): void {
  const location_info = def.location || (def as any).range;
  const ast_node = find_node_at_location(context.tree.rootNode, location_info);
  if (!ast_node) return;
  
  // Check if the class declaration has abstract modifier
  let current = ast_node;
  while (current && current.type !== 'class_declaration' && current.type !== 'abstract_class_declaration') {
    current = current.parent;
  }
  
  if (current && current.type === 'abstract_class_declaration') {
    (node as any).is_abstract = true;
  }
}

/**
 * Extract decorator name
 */
function extract_decorator_name(node: SyntaxNode, source_code: string): string | null {
  // Find the identifier or call_expression
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    
    if (child.type === 'identifier') {
      return source_code.substring(child.startIndex, child.endIndex);
    } else if (child.type === 'call_expression') {
      const fn = child.childForFieldName('function');
      if (fn) {
        return source_code.substring(fn.startIndex, fn.endIndex);
      }
    }
  }
  
  return null;
}

/**
 * Check if decorator is inheritance-related
 */
function is_inheritance_decorator(name: string): boolean {
  const inheritance_decorators = [
    'Injectable',
    'Component',
    'Directive',
    'Pipe',
    'Service',
    'Controller',
    'Module'
  ];
  
  return inheritance_decorators.includes(name);
}

/**
 * Find child node by type
 */
function find_child_by_type(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}

/**
 * Find node at location
 */
function find_node_at_location(
  root: SyntaxNode,
  location: AnyLocationFormat
): SyntaxNode | null {
  // Extract target position using shared utility
  const position = extractTargetPosition(location);
  if (!position) {
    return null;
  }
  
  const targetRow = position.row;
  
  function search(node: SyntaxNode): SyntaxNode | null {
    const start = node.startPosition;
    const end = node.endPosition;
    
    if (targetRow >= start.row && targetRow <= end.row) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          const found = search(child);
          if (found) return found;
        }
      }
      return node;
    }
    
    return null;
  }
  
  return search(root);
}