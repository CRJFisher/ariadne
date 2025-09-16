/**
 * Function call detection stub
 *
 * TODO: Implement using tree-sitter queries from function_call_queries/*.scm
 */

import { SyntaxNode } from "tree-sitter";
import {
  FilePath,
  Language,
  SourceCode,
  CallInfo,
  ScopeTree,
  Import,
  FunctionCall,
} from "@ariadnejs/types";

/**
 * Special constant for module-level calls (calls not within any function)
 */
export const MODULE_CONTEXT = "<module>";

/**
 * Context passed to all function call detection functions
 */
export interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  scope_tree?: ScopeTree;
  imports?: any[];
}

/**
 * Find all function calls in code
 */
export function find_function_calls(
  context: FunctionCallContext
): FunctionCall[] {
  // TODO: Implement using tree-sitter queries from function_call_queries/*.scm
  return [];
}
