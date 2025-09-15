/**
 * Constructor call detection stub
 *
 * TODO: Implement using tree-sitter queries from constructor_call_queries/*.scm
 */

import { SyntaxNode } from "tree-sitter";
import { Language, ConstructorCall, FilePath } from "@ariadnejs/types";

export interface ConstructorCallContext {
  source_code: string;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Find all constructor calls in the source code
 */
export function find_constructor_calls(
  context: ConstructorCallContext
): ConstructorCall[] {
  // TODO: Implement using tree-sitter queries from constructor_call_queries/*.scm
  return [];
}
