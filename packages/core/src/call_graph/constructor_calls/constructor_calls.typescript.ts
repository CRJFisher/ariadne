/**
 * TypeScript-specific constructor call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { ConstructorCallInfo } from '@ariadnejs/types';
import { 
  find_constructor_calls_javascript
} from './constructor_calls.javascript';
import { ConstructorCallContext } from './constructor_calls';

/**
 * Find all constructor calls in TypeScript code
 * 
 * TypeScript shares most logic with JavaScript but adds:
 * - Generic type arguments in constructor calls
 * - Abstract class handling
 * - Interface implementations
 */
export function find_constructor_calls_typescript(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  // Start with JavaScript detection
  const calls = find_constructor_calls_javascript(context);
  
  // Add TypeScript-specific constructor patterns
  const ts_calls = find_typescript_specific_constructors(context);
  
  return [...calls, ...ts_calls];
}

/**
 * Find TypeScript-specific constructor patterns
 */
function find_typescript_specific_constructors(
  context: ConstructorCallContext
): ConstructorCallInfo[] {
  const calls: ConstructorCallInfo[] = [];
  
  walk_tree(context.ast_root, (node) => {
    // Check for generic constructor calls: new ClassName<Type>()
    if (node.type === 'new_expression') {
      const type_args = node.childForFieldName('type_arguments');
      if (type_args) {
        // TODO: record the type arguments in ConstructorCallInfo
        // This is a generic constructor call
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
 * TypeScript-specific: Check if constructor has type arguments
 */
export function has_type_arguments_constructor(
  node: SyntaxNode
): boolean {
  if (node.type !== 'new_expression') {
    return false;
  }
  
  return node.childForFieldName('type_arguments') !== null;
}

/**
 * TypeScript-specific: Extract type arguments from constructor
 */
export function extract_constructor_type_arguments(
  node: SyntaxNode,
  source: string
): string[] {
  if (node.type !== 'new_expression') {
    return [];
  }
  
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
 * TypeScript-specific: Check if class is abstract
 */
export function is_abstract_class(
  node: SyntaxNode
): boolean {
  if (node.type !== 'class_declaration' && node.type !== 'class') {
    return false;
  }
  
  // Check for abstract modifier
  const firstChild = node.child(0);
  return firstChild?.type === 'abstract';
}

/**
 * TypeScript-specific: Check if class implements interfaces
 */
export function get_implemented_interfaces(
  node: SyntaxNode,
  source: string
): string[] {
  if (node.type !== 'class_declaration' && node.type !== 'class') {
    return [];
  }
  
  const interfaces: string[] = [];
  
  // Look for implements clause
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === 'implements_clause') {
      // Extract interface names
      for (let j = 0; j < child.childCount; j++) {
        const interface_node = child.child(j);
        if (interface_node && interface_node.type === 'type_identifier') {
          interfaces.push(source.substring(interface_node.startIndex, interface_node.endIndex));
        }
      }
    }
  }
  
  return interfaces;
}

/**
 * TypeScript-specific: Check for satisfies constraint in constructor
 */
export function has_satisfies_constraint(
  node: SyntaxNode
): boolean {
  if (node.type !== 'new_expression') {
    return false;
  }
  
  // Check if parent is a satisfies expression
  const parent = node.parent;
  return parent?.type === 'satisfies_expression';
}