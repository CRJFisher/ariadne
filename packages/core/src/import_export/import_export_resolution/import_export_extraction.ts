/**
 * Import extraction stub
 *
 * TODO: Implement using tree-sitter queries from import_queries/*.scm
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, Import, SourceCode, Export } from '@ariadnejs/types';

export interface ImportExportExtractionContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
}

/**
 * Extract imports from AST
 */
export function extract_imports(
  context: ImportExportExtractionContext
): Import[] {
  // TODO: Implement using tree-sitter queries from import_export/queries/*.scm
  return [];
}

/**
 * Extract exports from AST
 */
export function extract_exports(
  context: ImportExportExtractionContext
): Export[] {
  // TODO: Implement using tree-sitter queries from import_export/queries/*.scm
  return [];
}