/**
 * Import extraction stub
 *
 * TODO: Implement using tree-sitter queries from import_queries/*.scm
 */

import { SyntaxNode } from "tree-sitter";
import { Language, FilePath, SourceCode, Export } from "@ariadnejs/types";

export interface ExportExtractionContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Extract exports from AST
 */
export function extract_exports(context: ExportExtractionContext): Export[] {
  // TODO: Implement using tree-sitter queries from import_export/queries/*.scm
  // TODO: Test that BaseExport.symbol_name is unique per file - this is critical for symbol resolution as this is achieved by matching the string with the import name
  return [];
}
