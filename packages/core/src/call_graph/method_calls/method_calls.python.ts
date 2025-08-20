/**
 * Python-specific method call detection
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
 * Find all method calls in Python code
 */
export function find_method_calls_python(
  context: MethodCallContext
): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  const language: Language = 'python';
  
  // Walk the AST to find all call nodes
  walk_tree(context.ast_root, (node) => {
    if (is_method_call_node(node, language)) {
      const method_info = extract_python_method_call(node, context, language);
      if (method_info) {
        calls.push(method_info);
      }
    }
  });
  
  return calls;
}

/**
 * Extract Python method call information
 */
function extract_python_method_call(
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
  
  // Check if it's a special method call
  const is_static = is_static_method_python(node, context.source_code, receiver_name);
  const is_class_method = is_classmethod_call(node, context.source_code, receiver_name);
  
  return {
    caller_name,
    method_name,
    receiver_name,
    location: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    file_path: context.file_path,
    is_static_method: is_static || is_class_method,
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
    // Check for function definitions
    if (current.type === 'function_definition') {
      const name = current.childForFieldName('name');
      if (name) {
        const func_name = source.substring(name.startIndex, name.endIndex);
        
        // Check if it's a method in a class
        const class_name = get_enclosing_class(current, source, language);
        if (class_name) {
          return `${class_name}.${func_name}`;
        }
        return func_name;
      }
    }
    
    current = current.parent;
  }
  
  return null;
}

/**
 * Python-specific: Check if it's a static method call
 */
function is_static_method_python(
  node: SyntaxNode,
  source: string,
  receiver_name: string
): boolean {
  // Check if receiver starts with capital (class name convention)
  if (/^[A-Z]/.test(receiver_name)) {
    return true;
  }
  
  // Check for cls parameter (class methods)
  if (receiver_name === 'cls') {
    return true;
  }
  
  return false;
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
 * Python-specific: Check if it's a super() method call
 */
export function is_super_method_call(
  node: SyntaxNode,
  source: string
): boolean {
  const func = node.childForFieldName('func');
  if (!func || func.type !== 'attribute') {
    return false;
  }
  
  const object = func.childForFieldName('object');
  if (!object || object.type !== 'call') {
    return false;
  }
  
  // Check if the object is a super() call
  const super_func = object.childForFieldName('func');
  if (super_func && super_func.type === 'identifier') {
    const name = source.substring(super_func.startIndex, super_func.endIndex);
    return name === 'super';
  }
  
  return false;
}

/**
 * Python-specific: Check if it's a classmethod call
 */
export function is_classmethod_call(
  node: SyntaxNode,
  source: string,
  receiver_name: string
): boolean {
  // If receiver is 'cls', it's likely a classmethod
  if (receiver_name === 'cls') {
    return true;
  }
  
  // Check if receiver is a class name (capitalized)
  if (/^[A-Z]/.test(receiver_name)) {
    // Could be either static or class method
    // Would need decorator information to be sure
    return false;
  }
  
  return false;
}

/**
 * Python-specific: Check for dunder (magic) method calls
 */
export function is_dunder_method_call(
  method_name: string
): boolean {
  return method_name.startsWith('__') && method_name.endsWith('__');
}

/**
 * Python-specific: Check if it's a property access (not a method call)
 */
export function is_property_access(
  node: SyntaxNode,
  source: string
): boolean {
  // If parent is not a call, it's just property access
  const parent = node.parent;
  if (!parent || parent.type !== 'call') {
    return true;
  }
  
  // Check if this attribute is the function being called
  const func = parent.childForFieldName('func');
  return func !== node;
}