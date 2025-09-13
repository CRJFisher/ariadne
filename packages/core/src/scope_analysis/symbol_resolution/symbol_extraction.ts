/**
 * Symbol Extraction - Extract symbol definitions from AST
 *
 * This module provides symbol extraction functionality that will be
 * refactored to use the new query-based system.
 */

import { SyntaxNode } from 'tree-sitter';
import { Language, SymbolDefinition } from '@ariadnejs/types';

/**
 * Extract symbol definitions from AST
 *
 * @param root_node - The root syntax node to extract symbols from
 * @param source_code - The source code text
 * @param language - The programming language
 * @param file_path - The file path for context
 * @returns Array of symbol definitions found in the AST
 */
export function extract_symbols(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): SymbolDefinition[] {
  // TODO: Implement using new query-based system
  // See task 11.100.10 for implementation details
  return [];
}