/**
 * Python-specific bespoke features that cannot be expressed through configuration
 */

import { SyntaxNode } from 'tree-sitter';
import { FunctionCallContext, EnhancedFunctionCallInfo } from './function_calls';
import { node_to_location } from '../../ast/node_utils';

/**
 * Handle Python comprehensions
 * 
 * Comprehensions in Python can contain function calls that need to be extracted.
 * This handles list, set, dictionary comprehensions and generator expressions.
 */
export function handle_python_comprehensions(
  context: FunctionCallContext
): EnhancedFunctionCallInfo[] {
  const calls: EnhancedFunctionCallInfo[] = [];
  
  walk_tree(context.ast_root, (node) => {
    if (
      node.type === "list_comprehension" ||
      node.type === "dictionary_comprehension" ||
      node.type === "set_comprehension" ||
      node.type === "generator_expression"
    ) {
      walk_tree(node, (inner_node) => {
        if (inner_node.type === "call" && inner_node !== node) {
          const call_info = extract_python_call(inner_node, context);
          if (call_info) {
            calls.push({
              ...call_info,
              is_in_comprehension: true
            });
          }
        }
      });
    }
  });
  
  return calls;
}

/**
 * Extract Python call information (simplified for comprehensions)
 */
function extract_python_call(
  node: SyntaxNode,
  context: FunctionCallContext
): EnhancedFunctionCallInfo | null {
  const func_node = node.childForFieldName("function");
  if (!func_node) return null;
  
  let callee_name: string | null = null;
  let is_method = false;
  
  if (func_node.type === "identifier") {
    callee_name = context.source_code.substring(func_node.startIndex, func_node.endIndex);
  } else if (func_node.type === "attribute") {
    const attr = func_node.childForFieldName("attribute");
    if (attr) {
      callee_name = context.source_code.substring(attr.startIndex, attr.endIndex);
      is_method = true;
    }
  }
  
  if (!callee_name) return null;
  
  const caller_name = "<comprehension>";
  
  // Count arguments
  const args_node = node.childForFieldName("arguments");
  let args_count = 0;
  if (args_node) {
    for (let i = 0; i < args_node.childCount; i++) {
      const child = args_node.child(i);
      if (child && child.type !== "(" && child.type !== ")" && child.type !== ",") {
        args_count++;
      }
    }
  }
  
  return {
    caller_name,
    callee_name,
    location: node_to_location(node, context.file_path),
    is_method_call: is_method,
    is_constructor_call: /^[A-Z]/.test(callee_name),
    arguments_count: args_count,
  };
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