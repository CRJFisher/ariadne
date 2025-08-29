/**
 * Python-specific function call detection
 */

import { SyntaxNode } from "tree-sitter";
import { Language } from "@ariadnejs/types";
import { FunctionCallInfo } from "@ariadnejs/types";
import {
  extract_callee_name,
  FunctionCallContext,
  get_enclosing_function_name,
} from "./function_calls";

/**
 * Find all function calls in Python code
 */
export function find_function_calls_python(
  context: FunctionCallContext
): FunctionCallInfo[] {
  const calls: FunctionCallInfo[] = [];
  const language: Language = "python";

  // Walk the AST to find all call nodes
  walk_tree(context.ast_root, (node) => {
    if (node.type === "call") {
      const call_info = extract_python_call(node, context, language);
      if (call_info) {
        calls.push(call_info);
      }
    }
  });

  return calls;
}

/**
 * Extract Python call information
 */
function extract_python_call(
  node: SyntaxNode,
  context: FunctionCallContext,
  language: Language
): FunctionCallInfo | null {
  const callee_name = extract_callee_name(node, context.source_code, language);
  if (!callee_name) return null;

  const caller_name =
    get_enclosing_function_name(node, context.source_code, language) ||
    "<module>";

  // Check if it's a method call
  const func_node = node.childForFieldName("func");
  const is_method = func_node?.type === "attribute";

  // Check if it's a constructor call (class instantiation)
  const is_constructor = is_class_instantiation(node, context.source_code);

  // Count arguments
  const args_count = count_python_arguments(node);

  return {
    caller_name,
    callee_name,
    location: {
      line: node.startPosition.row,
      column: node.startPosition.column,
    },
    is_method_call: is_method,
    is_constructor_call: is_constructor,
    arguments_count: args_count,
  };
}

/**
 * Check if a call is a class instantiation (constructor call)
 */
function is_class_instantiation(node: SyntaxNode, source: string): boolean {
  const func_node = node.childForFieldName("func");
  if (!func_node) return false;

  // If it's an identifier starting with capital letter, likely a class
  if (func_node.type === "identifier") {
    const name = source.substring(func_node.startIndex, func_node.endIndex);
    return /^[A-Z]/.test(name);
  }

  // If it's an attribute access, check the last part
  if (func_node.type === "attribute") {
    const attr = func_node.childForFieldName("attr");
    if (attr) {
      const name = source.substring(attr.startIndex, attr.endIndex);
      return /^[A-Z]/.test(name);
    }
  }

  return false;
}

/**
 * Count Python arguments including positional and keyword arguments
 */
function count_python_arguments(node: SyntaxNode): number {
  const args_node = node.childForFieldName("arguments");
  if (!args_node) return 0;

  let count = 0;

  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (!child) continue;

    // Count positional arguments
    if (
      child.type !== "(" &&
      child.type !== ")" &&
      child.type !== "," &&
      child.type !== "comment" &&
      child.type !== "keyword_argument"
    ) {
      count++;
    }

    // Count keyword arguments
    if (child.type === "keyword_argument") {
      count++;
    }
  }

  return count;
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

/**
 * Python-specific: Check if a call is a decorator
 */
export function is_decorator_call(node: SyntaxNode): boolean {
  const parent = node.parent;
  return parent?.type === "decorator";
}

/**
 * Python-specific: Check if it's a comprehension call
 */
export function is_comprehension_call(node: SyntaxNode): boolean {
  let parent = node.parent;
  while (parent) {
    if (
      parent.type === "list_comprehension" ||
      parent.type === "dictionary_comprehension" ||
      parent.type === "set_comprehension" ||
      parent.type === "generator_expression"
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/**
 * Python-specific: Check for async calls
 */
export function is_async_call_python(node: SyntaxNode): boolean {
  const parent = node.parent;
  return parent?.type === "await";
}

/**
 * Python-specific: Extract super() calls
 */
export function is_super_call(node: SyntaxNode, source: string): boolean {
  const func_node = node.childForFieldName("func");
  if (func_node && func_node.type === "identifier") {
    const name = source.substring(func_node.startIndex, func_node.endIndex);
    return name === "super";
  }
  return false;
}
