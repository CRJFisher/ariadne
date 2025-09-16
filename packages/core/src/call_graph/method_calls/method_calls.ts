import { FilePath, Language, MethodCall, SourceCode } from "@ariadnejs/types";
import { SyntaxNode } from "tree-sitter";

export interface MethodCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Find all method calls in source code
 */
export function find_method_calls(context: MethodCallContext): MethodCall[] {
  // TODO: Implement using tree-sitter queries from method_call_queries/*.scm
  return [];
}
