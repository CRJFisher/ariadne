/**
 * JavaScript-specific method call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language } from '@ariadnejs/types';
import {
  MethodCallInfo,
  MethodCallContext,
  is_method_call_node,
  extract_receiver_name,
  extract_method_name,
  is_static_method_call,
  is_chained_method_call,
  count_method_arguments,
  get_enclosing_class
} from './method_calls';

/**
 * Find all method calls in JavaScript code
 */
export function find_method_calls_javascript(
  context: MethodCallContext
): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  const language: Language = 'javascript';
  
  // Walk the AST to find all call expressions
  walk_tree(context.ast_root, (node) => {
    if (is_method_call_node(node, language)) {
      const method_info = extract_javascript_method_call(node, context, language);
      if (method_info) {
        calls.push(method_info);
      }
    }
  });
  
  return calls;
}

/**
 * Extract JavaScript method call information
 */
function extract_javascript_method_call(
  node: SyntaxNode,
  context: MethodCallContext,
  language: Language
): MethodCallInfo | null {
  const receiver_name = extract_receiver_name(node, context.source_code, language);
  const method_name = extract_method_name(node, context.source_code, language);
  
  if (!receiver_name || !method_name) {
    return null;
  }
  
  // Determine the caller (enclosing function or class)
  const caller_name = get_caller_context(node, context.source_code, language) || '<module>';
  
  return {
    caller_name,
    method_name,
    receiver_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    is_static_method: is_static_method_call(node, context.source_code, language),
    is_chained_call: is_chained_method_call(node, language),
    arguments_count: count_method_arguments(node, language)
  };
}

/**
 * Get the context (function/method) where the call is made
 */
function get_caller_context(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  let current = node.parent;
  
  while (current) {
    // Check for function/method definitions
    if (current.type === 'function_declaration' ||
        current.type === 'function_expression' ||
        current.type === 'arrow_function') {
      const name = current.childForFieldName('name');
      if (name) {
        return source.substring(name.startIndex, name.endIndex);
      }
      // For anonymous functions
      return '<anonymous>';
    }
    
    // Check for method definitions
    if (current.type === 'method_definition') {
      const key = current.childForFieldName('key');
      if (key) {
        const method_name = source.substring(key.startIndex, key.endIndex);
        
        // Try to get the class name
        const class_name = get_enclosing_class(current, source, language);
        if (class_name) {
          return `${class_name}.${method_name}`;
        }
        return method_name;
      }
    }
    
    current = current.parent;
  }
  
  return null;
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
 * JavaScript-specific: Detect prototype method calls
 */
export function is_prototype_method_call(
  node: SyntaxNode,
  source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') {
    return false;
  }
  
  const object = func.childForFieldName('object');
  if (!object || object.type !== 'member_expression') {
    return false;
  }
  
  // Check if it's ClassName.prototype.methodName pattern
  const property = object.childForFieldName('property');
  if (property) {
    const prop_text = source.substring(property.startIndex, property.endIndex);
    return prop_text === 'prototype';
  }
  
  return false;
}

/**
 * JavaScript-specific: Detect call/apply/bind invocations
 */
export function is_indirect_method_call(
  node: SyntaxNode,
  source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'member_expression') {
    return false;
  }
  
  const property = func.childForFieldName('property');
  if (property) {
    const method_name = source.substring(property.startIndex, property.endIndex);
    return ['call', 'apply', 'bind'].includes(method_name);
  }
  
  return false;
}

/**
 * JavaScript-specific: Detect optional chaining method calls (obj?.method())
 */
export function is_optional_chaining_call(
  node: SyntaxNode,
  source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func) return false;
  
  // Check for optional_member_expression
  return func.type === 'optional_member_expression';
}