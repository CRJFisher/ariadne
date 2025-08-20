/**
 * JavaScript-specific constructor call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language } from '@ariadnejs/types';
import {
  ConstructorCallInfo,
  ConstructorCallContext,
  TypeAssignment,
  is_constructor_call_node,
  extract_constructor_name,
  find_assignment_target,
  count_constructor_arguments,
  uses_new_keyword,
  get_assignment_scope,
  create_type_assignment
} from './constructor_calls';

/**
 * Find all constructor calls in JavaScript code
 */
export function find_constructor_calls_javascript(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  const calls: ConstructorCallInfo[] = [];
  const language: Language = 'javascript';
  
  // Walk the AST to find all new expressions
  walk_tree(context.ast_root, (node) => {
    if (is_constructor_call_node(node, language)) {
      const call_info = extract_javascript_constructor_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    }
    
    // Also check for capitalized function calls (constructor convention)
    if (node.type === 'call_expression') {
      const func = node.childForFieldName('function');
      if (func && func.type === 'identifier') {
        const name = context.source_code.substring(func.startIndex, func.endIndex);
        if (/^[A-Z]/.test(name)) {
          // Likely a constructor call without 'new' (older style or factory)
          const call_info = extract_javascript_factory_call(node, context, language);
          if (call_info) {
            calls.push(call_info);
          }
        }
      }
    }
  });
  
  return calls;
}

/**
 * Extract JavaScript constructor call information (new expression)
 */
function extract_javascript_constructor_call(
  node: SyntaxNode,
  context: ConstructorCallContext,
  language: Language
): ConstructorCallInfo | null {
  const constructor_name = extract_constructor_name(node, context.source_code, language);
  if (!constructor_name) return null;
  
  const assigned_to = find_assignment_target(node, context.source_code, language);
  
  return {
    constructor_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: count_constructor_arguments(node, language),
    assigned_to: assigned_to || undefined,
    is_new_expression: true,
    is_factory_method: false
  };
}

/**
 * Extract factory-style constructor call (capitalized function without new)
 */
function extract_javascript_factory_call(
  node: SyntaxNode,
  context: ConstructorCallContext,
  language: Language
): ConstructorCallInfo | null {
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'identifier') return null;
  
  const constructor_name = context.source_code.substring(func.startIndex, func.endIndex);
  const assigned_to = find_assignment_target(node, context.source_code, language);
  
  return {
    constructor_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    arguments_count: count_constructor_arguments(node, language),
    assigned_to: assigned_to || undefined,
    is_new_expression: false,
    is_factory_method: true
  };
}

/**
 * Get type assignments from constructor calls
 */
export function get_type_assignments_javascript(
  context: ConstructorCallContext
): TypeAssignment[] {
  const assignments: TypeAssignment[] = [];
  const calls = find_constructor_calls_javascript(context);
  
  for (const call of calls) {
    if (call.assigned_to) {
      const scope = get_assignment_scope_js(context.ast_root, call.location, context.source_code);
      const assignment = create_type_assignment(call, call.assigned_to, scope);
      assignments.push(assignment);
    }
  }
  
  return assignments;
}

/**
 * Get the scope of an assignment at a specific location
 */
function get_assignment_scope_js(
  root: SyntaxNode,
  location: { row: number; column: number },
  source: string
): 'local' | 'global' | 'member' {
  // Find the node at this location
  const node = root.descendantForPosition(
    { row: location.row, column: location.column },
    { row: location.row, column: location.column + 1 }
  );
  
  if (!node) return 'global';
  
  return get_assignment_scope(node, 'javascript');
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
 * JavaScript-specific: Check for Object.create() pattern
 */
export function is_object_create_pattern(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'call_expression') return false;
  
  const func = node.childForFieldName('function');
  if (func && func.type === 'member_expression') {
    const object = func.childForFieldName('object');
    const property = func.childForFieldName('property');
    
    if (object && property) {
      const obj_name = source.substring(object.startIndex, object.endIndex);
      const prop_name = source.substring(property.startIndex, property.endIndex);
      return obj_name === 'Object' && prop_name === 'create';
    }
  }
  
  return false;
}

/**
 * JavaScript-specific: Check for class extends pattern
 */
export function is_class_extends(
  node: SyntaxNode,
  source: string
): boolean {
  if (node.type !== 'class_declaration' && node.type !== 'class') {
    return false;
  }
  
  const heritage = node.childForFieldName('heritage');
  return heritage !== null;
}

/**
 * JavaScript-specific: Get parent class name
 */
export function get_parent_class(
  node: SyntaxNode,
  source: string
): string | null {
  if (node.type !== 'class_declaration' && node.type !== 'class') {
    return null;
  }
  
  const heritage = node.childForFieldName('heritage');
  if (heritage) {
    // heritage is 'extends ParentClass'
    // Find the identifier child
    for (let i = 0; i < heritage.childCount; i++) {
      const child = heritage.child(i);
      if (child && child.type === 'identifier') {
        return source.substring(child.startIndex, child.endIndex);
      }
    }
  }
  
  return null;
}