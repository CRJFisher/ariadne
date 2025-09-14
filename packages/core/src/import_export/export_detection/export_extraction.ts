/**
 * Export extraction stub
 *
 * TODO: Implement using tree-sitter queries from export_queries/*.scm
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, Export } from '@ariadnejs/types';

export interface ExportExtractionContext {
  source_code: string;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Extract exports from AST
 */
export function extract_exports(
  context: ExportExtractionContext
): Export[] {
  // TODO: Implement using tree-sitter queries from export_queries/*.scm
  return [];
}