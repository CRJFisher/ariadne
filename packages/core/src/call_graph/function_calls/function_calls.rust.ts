/**
 * Rust-specific bespoke features that cannot be expressed through configuration
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionCallContext, MODULE_CONTEXT, EnhancedFunctionCallInfo } from './function_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle Rust macros
 * 
 * Rust macros have unique syntax with the ! suffix and special token tree arguments
 */
export function handle_rust_macros(
  context: FunctionCallContext
): EnhancedFunctionCallInfo[] {
  const calls: EnhancedFunctionCallInfo[] = [];
  
  walk_tree(context.ast_root, (node) => {
    if (node.type === 'macro_invocation') {
      const macro_call = extract_macro_call(node, context);
      if (macro_call) {
        calls.push(macro_call);
      }
    }
  });
  
  return calls;
}

/**
 * Extract macro call information
 */
function extract_macro_call(
  node: SyntaxNode,
  context: FunctionCallContext
): EnhancedFunctionCallInfo | null {
  // Get the macro name - Rust uses 'macro' field
  const name_node = node.childForFieldName('macro');
  if (!name_node) return null;
  
  const macro_name = context.source_code.substring(name_node.startIndex, name_node.endIndex) + '!';
  const caller_name = get_enclosing_function(node, context.source_code) || MODULE_CONTEXT;
  
  // Count macro arguments (simplified - just count top-level tokens)
  const token_tree = node.childForFieldName('token_tree');
  const args_count = token_tree ? Math.max(1, Math.floor(token_tree.childCount / 2)) : 0;
  
  return {
    caller_name,
    callee_name: macro_name,
    location: node_to_location(node, context.file_path),
    is_method_call: false,
    is_constructor_call: false,
    is_macro_call: true,
    arguments_count: args_count
  };
}

/**
 * Get enclosing function name for Rust
 */
function get_enclosing_function(
  node: SyntaxNode,
  source: string
): string | null {
  let current = node.parent;
  
  while (current) {
    if (current.type === 'function_item' || current.type === 'method_item') {
      const name_node = current.childForFieldName('name');
      if (name_node) {
        return source.substring(name_node.startIndex, name_node.endIndex);
      }
    }
    current = current.parent;
  }
  
  return null;
}

/**
 * Walk the AST tree
 */
function walk_tree(
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void
): void {
  callback(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}