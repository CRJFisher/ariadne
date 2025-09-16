import { FilePath, FunctionDefinition } from "@ariadnejs/types";
import { SyntaxNode } from "tree-sitter";

export function extract_definitions(
  root_node: SyntaxNode,
  file_path: FilePath
): FunctionDefinition[] {
  const functions: FunctionDefinition[] = [];
  
  // TODO: Implement using tree-sitter queries from function_definition/queries/*.scm

  return functions;
}
