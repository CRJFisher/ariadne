/**
 * JavaScript-specific function call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, FunctionCallInfo } from '@ariadnejs/types';
import {
  FunctionCallContext,
  is_function_call_node,
  extract_callee_name,
  is_method_call,
  get_method_receiver,
  count_arguments,
  get_enclosing_function_name
} from './function_calls';

/**
 * Find all function calls in JavaScript code
 */
export function find_function_calls_javascript(
  context: FunctionCallContext
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];
  const language: Language = 'javascript';
  
  // Walk the AST to find all call expressions
  walk_tree(context.ast_root, (node) => {
    if (is_function_call_node(node, language)) {
      const callee_name = extract_callee_name(node, context.source_code, language);
      if (!callee_name) return;
      
      const caller_name = get_enclosing_function_name(node, context.source_code, language) || '<module>';
      
      const call_info: FunctionCallInfo = {
        callee_name,
        caller_name,
        location: {
          line: node.startPosition.row,
          column: node.startPosition.column
        },
        is_method_call: is_method_call(node, language),
        is_constructor_call: is_constructor_call_js(node, context.source_code),
        arguments_count: count_arguments(node, language)
      };
      
      calls.push(call_info);
    }
  });
  
  return calls;
}

/**
 * Check if a call is a constructor call (new keyword)
 */
function is_constructor_call_js(node: SyntaxNode, source: string): boolean {
  const parent = node.parent;
  if (!parent) return false;
  
  // Check for 'new' expression
  if (parent.type === 'new_expression') {
    return true;
  }
  
  // Check if callee starts with capital letter (convention)
  const function_node = node.childForFieldName('function');
  if (function_node && function_node.type === 'identifier') {
    const name = source.substring(function_node.startIndex, function_node.endIndex);
    return /^[A-Z]/.test(name);
  }
  
  return false;
}

/**
 * Walk the AST tree and call callback for each node
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
 * JavaScript-specific handling for async/generator calls
 */
export function is_async_call(node: SyntaxNode, source: string): boolean {
  // Check for await expression
  const parent = node.parent;
  if (parent && parent.type === 'await_expression') {
    return true;
  }
  
  // Check if the function being called is async
  const function_node = node.childForFieldName('function');
  if (function_node) {
    // This would require resolution to the function definition
    // For now, we can detect patterns like .then() or .catch()
    if (function_node.type === 'member_expression') {
      const property = function_node.childForFieldName('property');
      if (property) {
        const prop_name = source.substring(property.startIndex, property.endIndex);
        return ['then', 'catch', 'finally'].includes(prop_name);
      }
    }
  }
  
  return false;
}

/**
 * JavaScript-specific handling for generator calls
 */
export function is_generator_call(node: SyntaxNode, source: string): boolean {
  // Check for yield expression
  const parent = node.parent;
  if (parent && parent.type === 'yield_expression') {
    return true;
  }
  
  return false;
}