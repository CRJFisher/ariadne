/**
 * Rust-specific method call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, MethodCallInfo } from '@ariadnejs/types';
import {
  MethodCallContext,
  is_method_call_node,
  extract_receiver_name,
  extract_method_name,
  is_chained_method_call,
  count_method_arguments
} from './method_calls';
import { TypeInfo } from '../../type_analysis/type_tracking';
import { 
  resolve_receiver_type,
  MethodCallWithType,
  infer_defining_class
} from './receiver_type_resolver';

/**
 * Find all method calls in Rust code
 */
export function find_method_calls_rust(
  context: MethodCallContext,
  type_map?: Map<string, TypeInfo[]>
): MethodCallInfo[] {
  const calls: MethodCallInfo[] = [];
  const language: Language = 'rust';
  
  // Walk the AST to find all call expressions
  walk_tree(context.ast_root, (node) => {
    if (is_method_call_node(node, language)) {
      const method_info = extract_rust_method_call(node, context, language, type_map);
      if (method_info) {
        calls.push(method_info as MethodCallInfo);
      }
    }
  });
  
  return calls;
}

/**
 * Extract Rust method call information with type resolution
 */
function extract_rust_method_call(
  node: SyntaxNode,
  context: MethodCallContext,
  language: Language,
  type_map?: Map<string, TypeInfo[]>
): MethodCallWithType | null {
  const receiver_name = extract_receiver_name(node, context.source_code, language);
  const method_name = extract_method_name(node, context.source_code, language);
  
  if (!receiver_name || !method_name) {
    return null;
  }
  
  // Determine the caller (enclosing function or impl block)
  const caller_name = get_caller_context(node, context.source_code) || '<module>';
  
  // Check if it's an associated function (static method)
  const is_associated = is_associated_function_call(node, context.source_code);
  
  // Try to resolve the receiver type
  let receiver_type: string | undefined;
  let defining_class: string | undefined;
  
  // Get the receiver node to resolve its type
  if (node.type === 'call_expression') {
    const func = node.childForFieldName('function');
    if (func?.type === 'field_expression') {
      const value = func.childForFieldName('value');
      if (value) {
        receiver_type = resolve_receiver_type(value, type_map, context.source_code, language);
        if (receiver_type) {
          defining_class = infer_defining_class(method_name, receiver_type);
        }
      }
    } else if (func?.type === 'scoped_identifier') {
      // For associated functions (Type::method), the receiver type is the scope
      const path = func.childForFieldName('path');
      if (path) {
        receiver_type = context.source_code.substring(path.startIndex, path.endIndex);
        defining_class = receiver_type;
      }
    }
  }
  
  return {
    caller_name,
    method_name,
    receiver_name,
    receiver_type,
    defining_class,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column
    },
    is_static_method: is_associated,
    is_chained_call: is_chained_method_call(node, language),
    arguments_count: count_method_arguments(node, language)
  };
}

/**
 * Get the context (function/impl block) where the call is made
 */
function get_caller_context(
  node: SyntaxNode,
  source: string
): string | null {
  let current = node.parent;
  
  while (current) {
    // Check for function items
    if (current.type === 'function_item') {
      const name = current.childForFieldName('name');
      if (name) {
        const func_name = source.substring(name.startIndex, name.endIndex);
        
        // Check if it's in an impl block
        const impl_name = get_enclosing_impl(current, source);
        if (impl_name) {
          return `${impl_name}::${func_name}`;
        }
        return func_name;
      }
    }
    
    current = current.parent;
  }
  
  return null;
}

/**
 * Get the enclosing impl block
 */
function get_enclosing_impl(
  node: SyntaxNode,
  source: string
): string | null {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      const type_node = current.childForFieldName('type');
      if (type_node) {
        return source.substring(type_node.startIndex, type_node.endIndex);
      }
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Check if it's an associated function call (Type::method)
 */
function is_associated_function_call(
  node: SyntaxNode,
  source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func) return false;
  
  // Associated functions use scoped_identifier (Type::method)
  if (func.type === 'scoped_identifier') {
    return true;
  }
  
  // Regular methods use field_expression (instance.method)
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
 * Rust-specific: Check if it's a trait method call
 */
export function is_trait_method_call(
  node: SyntaxNode,
  _source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func) return false;
  
  // Trait methods can be called with UFCS: <Type as Trait>::method
  if (func.type === 'generic_type' || func.type === 'qualified_type') {
    return true;
  }
  
  return false;
}

/**
 * Rust-specific: Check if method call is in unsafe block
 */
export function is_unsafe_method_call(
  node: SyntaxNode
): boolean {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'unsafe_block') {
      return true;
    }
    current = current.parent;
  }
  
  return false;
}

/**
 * Rust-specific: Check if it's a method call with turbofish syntax
 */
export function has_turbofish_syntax(
  node: SyntaxNode,
  _source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func) return false;
  
  // Look for ::<Type> pattern
  if (func.type === 'field_expression') {
    const field = func.childForFieldName('field');
    if (field && field.type === 'generic_function') {
      return true;
    }
  }
  
  return false;
}

/**
 * Rust-specific: Detect method calls on references (&self, &mut self)
 */
export function is_ref_method_call(
  node: SyntaxNode,
  _source: string
): boolean {
  const func = node.childForFieldName('function');
  if (!func || func.type !== 'field_expression') {
    return false;
  }
  
  const value = func.childForFieldName('value');
  if (value) {
    // Check if receiver is a reference expression
    return value.type === 'reference_expression' || 
           value.type === 'mutable_reference_expression';
  }
  
  return false;
}

/**
 * Rust-specific: Extract impl trait if present
 */
export function get_impl_trait(
  node: SyntaxNode,
  source: string
): string | null {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'impl_item') {
      // Check if it's a trait implementation
      const trait_node = current.childForFieldName('trait');
      if (trait_node) {
        return source.substring(trait_node.startIndex, trait_node.endIndex);
      }
      return null;
    }
    current = current.parent;
  }
  
  return null;
}