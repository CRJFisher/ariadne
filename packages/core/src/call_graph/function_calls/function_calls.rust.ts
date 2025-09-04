/**
 * Rust-specific function call detection
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionCallContext } from './function_calls';
import { FunctionCallInfo, Language } from '@ariadnejs/types';
import {
  extract_callee_name,
  get_enclosing_function_name,
  count_arguments
} from './function_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Find all function calls in Rust code
 */
export function find_function_calls_rust(
  context: FunctionCallContext
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];
  const language: Language = 'rust';
  
  // Walk the AST to find all call expressions and macro invocations
  walk_tree(context.ast_root, (node) => {
    if (node.type === 'call_expression') {
      const call_info = extract_rust_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    } else if (node.type === 'macro_invocation') {
      const macro_call = extract_macro_call(node, context);
      if (macro_call) {
        calls.push(macro_call);
      }
    }
  });
  
  return calls;
}

/**
 * Extract Rust call information
 */
function extract_rust_call(
  node: SyntaxNode,
  context: FunctionCallContext,
  language: Language
): FunctionCallInfo | null {
  const callee_name = extract_callee_name(node, context.source_code, language);
  if (!callee_name) return null;
  
  const caller_name = get_enclosing_function_name(node, context.source_code, language) || '<module>';
  
  // Check if it's a method call
  const func_node = node.childForFieldName('function');
  const is_method = is_method_call_rust(func_node, context.source_code);
  
  // Check if it's a constructor call (struct instantiation or enum variant)
  const is_constructor = is_constructor_call_rust(node, func_node, context.source_code);
  
  return {
    caller_name,
    callee_name,
    location: node_to_location(node, context.file_path),
    is_method_call: is_method,
    is_constructor_call: is_constructor,
    arguments_count: count_arguments(node, language)
  };
}

/**
 * Check if a call is a method call in Rust
 */
function is_method_call_rust(func_node: SyntaxNode | null, source: string): boolean {
  if (!func_node) return false;
  
  // Method calls use field_expression (obj.method)
  if (func_node.type === 'field_expression') {
    return true;
  }
  
  // Check for UFCS (Universal Function Call Syntax) - Type::method
  if (func_node.type === 'scoped_identifier') {
    const path = func_node.childForFieldName('path');
    // If path is a type (starts with capital), it might be a static method
    if (path && path.type === 'identifier') {
      const name = source.substring(path.startIndex, path.endIndex);
      // Associated functions are not instance methods
      return false;
    }
  }
  
  return false;
}

/**
 * Check if it's a constructor call in Rust
 */
function is_constructor_call_rust(
  node: SyntaxNode,
  func_node: SyntaxNode | null,
  source: string
): boolean {
  if (!func_node) return false;
  
  // Struct instantiation (StructName { ... }) is handled differently
  // This is for tuple structs: StructName(...)
  if (func_node.type === 'identifier' || func_node.type === 'scoped_identifier') {
    const name = extract_type_name(func_node, source);
    // Check if it starts with capital letter (type convention)
    return /^[A-Z]/.test(name);
  }
  
  return false;
}

/**
 * Extract type name from scoped or simple identifier
 */
function extract_type_name(node: SyntaxNode, source: string): string {
  if (node.type === 'identifier') {
    return source.substring(node.startIndex, node.endIndex);
  }
  
  if (node.type === 'scoped_identifier') {
    const name = node.childForFieldName('name');
    if (name) {
      return source.substring(name.startIndex, name.endIndex);
    }
  }
  
  return '';
}

/**
 * Extract macro invocation information
 */
function extract_macro_call(
  node: SyntaxNode,
  context: FunctionCallContext
): FunctionCallInfo | null {
  // Get macro name
  const macro_node = node.childForFieldName('macro');
  if (!macro_node) return null;
  
  let macro_name = context.source_code.substring(macro_node.startIndex, macro_node.endIndex);
  
  // Get enclosing function
  const caller_name = get_rust_enclosing_function(node, context.source_code) || '<module>';
  
  // Count macro arguments (if any)
  const token_tree = node.childForFieldName('token_tree');
  const args_count = count_macro_arguments(token_tree);
  
  return {
    caller_name,
    callee_name: macro_name + '!', // Add ! to indicate it's a macro
    location: node_to_location(node, context.file_path),
    is_method_call: false,
    is_constructor_call: false,
    arguments_count: args_count
  };
}

/**
 * Count macro arguments (approximate)
 */
function count_macro_arguments(token_tree: SyntaxNode | null): number {
  if (!token_tree) return 0;
  
  // This is approximate - macros can have complex syntax
  let count = 0;
  let depth = 0;
  
  for (let i = 0; i < token_tree.childCount; i++) {
    const child = token_tree.child(i);
    if (!child) continue;
    
    if (child.type === '(' || child.type === '[' || child.type === '{') {
      depth++;
    } else if (child.type === ')' || child.type === ']' || child.type === '}') {
      depth--;
    } else if (child.type === ',' && depth === 1) {
      count++;
    }
  }
  
  // If we have any content, we have at least one argument
  return token_tree.childCount > 2 ? count + 1 : 0;
}

/**
 * Get enclosing function for Rust (handles impl blocks)
 */
function get_rust_enclosing_function(node: SyntaxNode, source: string): string | null {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'function_item') {
      const name = current.childForFieldName('name');
      if (name) {
        const func_name = source.substring(name.startIndex, name.endIndex);
        
        // Check if this is inside an impl block
        let impl_parent = current.parent;
        while (impl_parent) {
          if (impl_parent.type === 'impl_item') {
            const type_node = impl_parent.childForFieldName('type');
            if (type_node) {
              const type_name = extract_type_name(type_node, source);
              return `${type_name}::${func_name}`;
            }
          }
          impl_parent = impl_parent.parent;
        }
        
        return func_name;
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
 * Rust-specific: Check for unsafe calls
 */
export function is_unsafe_call(node: SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (parent.type === 'unsafe_block') {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Rust-specific: Check for async calls
 */
export function is_async_call_rust(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent && parent.type === 'await_expression') {
    return true;
  }
  return false;
}

/**
 * Handle Rust macros (bespoke feature export for generic processor)
 * 
 * Note: Rust macro handling is already done in the generic processor
 * through configuration. This export is kept for compatibility but
 * returns an empty array as the generic processor handles macros.
 */
export function handle_rust_macros(
  context: FunctionCallContext
): FunctionCallInfo[] {
  // Macros are already handled by the generic processor using configuration
  // This function exists for API consistency but doesn't need to do anything
  return [];
}