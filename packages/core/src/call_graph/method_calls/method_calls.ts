/**
 * Method call detection stub
 *
 * TODO: Implement using tree-sitter queries from method_call_queries/*.scm
 */

import { SyntaxNode } from "tree-sitter";
import { Language, CallInfo } from "@ariadnejs/types";

export interface MethodCallContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Module context identifier for method calls
 */
export const METHOD_CALLS_CONTEXT = 'method_calls' as const;

/**
 * Find all method calls in the source code
 */
export function find_method_calls(
  context: MethodCallContext
): CallInfo[] {
  // TODO: Implement using tree-sitter queries from method_call_queries/*.scm
  return [];
}