/**
 * Import extraction stub
 *
 * TODO: Implement using tree-sitter queries from import_queries/*.scm
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, Import } from '@ariadnejs/types';

export interface ImportExtractionContext {
  source_code: string;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Extract imports from AST
 */
export function extract_imports(
  context: ImportExtractionContext
): Import[] {
  // TODO: Implement using tree-sitter queries from import_queries/*.scm
  return [];
}