/**
 * Method call detection stub
 *
 * TODO: Implement using tree-sitter queries from method_call_queries/*.scm
 */

import { SyntaxNode } from "tree-sitter";
import { CallInfo } from "@ariadnejs/types";

export interface MethodCallContext {
  source_code: string;
  file_path: string;
  language: string;
  ast_root: SyntaxNode;
}

/**
 * Find all method calls in source code
 */
export function find_method_calls(
  context: MethodCallContext
): CallInfo[] {
  // TODO: Implement using tree-sitter queries from method_call_queries/*.scm
  return [];
}