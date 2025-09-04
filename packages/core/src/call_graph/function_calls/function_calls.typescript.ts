/**
 * TypeScript-specific bespoke features
 * 
 * Only contains features that cannot be expressed through configuration
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionCallContext } from './function_calls';
import { FunctionCallInfo } from '@ariadnejs/types';

/**
 * Handle TypeScript decorators (bespoke feature export for generic processor)
 * 
 * Decorators in TypeScript require special handling as they have unique
 * syntax and semantics that can't be expressed through configuration.
 */
export function handle_typescript_decorators(
  context: FunctionCallContext
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];
  
  walk_tree(context.ast_root, (node) => {
    // Decorator calls
    if (node.type === 'decorator') {
      const decorator_call = extract_decorator_call(node, context);
      if (decorator_call) {
        calls.push(decorator_call);
      }
    }
  });
  
  return calls;
}

/**
 * Extract decorator call information
 */
function extract_decorator_call(
  node: SyntaxNode,
  context: FunctionCallContext
): FunctionCallInfo | null {
  // Get the decorator expression
  const expr = node.child(1); // Skip @ symbol
  if (!expr) return null;
  
  let callee_name: string | null = null;
  let is_call = false;
  
  if (expr.type === 'identifier') {
    // Simple decorator: @decorator
    callee_name = context.source_code.substring(expr.startIndex, expr.endIndex);
  } else if (expr.type === 'call_expression') {
    // Decorator with arguments: @decorator(args)
    is_call = true;
    const func = expr.childForFieldName('function');
    if (func) {
      callee_name = context.source_code.substring(func.startIndex, func.endIndex);
    }
  }
  
  if (!callee_name) return null;
  
  // Find the enclosing class or function
  let parent = node.parent;
  let caller_name = '<module>';
  
  while (parent) {
    if (parent.type === 'class_declaration' || parent.type === 'class') {
      const name = parent.childForFieldName('name');
      if (name) {
        caller_name = context.source_code.substring(name.startIndex, name.endIndex);
        break;
      }
    } else if (parent.type === 'function_declaration' || parent.type === 'method_definition') {
      const name = parent.childForFieldName('name') || parent.childForFieldName('key');
      if (name) {
        caller_name = context.source_code.substring(name.startIndex, name.endIndex);
        break;
      }
    }
    parent = parent.parent;
  }
  
  return {
    caller_name,
    callee_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    is_method_call: false,
    is_constructor_call: false,
    arguments_count: is_call ? count_decorator_arguments(expr) : 0
  };
}

/**
 * Count arguments in a decorator call
 */
function count_decorator_arguments(node: SyntaxNode): number {
  const args = node.childForFieldName('arguments');
  if (!args) return 0;
  
  let count = 0;
  for (let i = 0; i < args.childCount; i++) {
    const child = args.child(i);
    if (child && child.type !== '(' && child.type !== ')' && child.type !== ',') {
      count++;
    }
  }
  
  return count;
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