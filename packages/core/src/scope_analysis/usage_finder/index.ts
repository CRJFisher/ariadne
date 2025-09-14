/**
 * Usage finder stub
 *
 * TODO: Implement using tree-sitter queries from usage_finder_queries/*.scm
 */

import type { SyntaxNode } from 'tree-sitter';
import { Language, Location } from '@ariadnejs/types';

/**
 * Reference to a symbol usage
 */
export interface Usage {
  symbol_name: string;
  location: Location;
  usage_type: 'read' | 'write' | 'call';
}

/**
 * Find all references to a symbol in code
 */
export function find_all_references(
  symbol_name: string,
  scope_tree: any,
  language: Language,
  file_path: string,
  root_node: SyntaxNode,
  source_code: string
): Usage[] {
  // TODO: Implement using tree-sitter queries from usage_finder_queries/*.scm
  return [];
}

/**
 * Find usages of symbols
 */
export function find_usages(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  scope_tree: any
): Usage[] {
  // TODO: Implement using tree-sitter queries from usage_finder_queries/*.scm
  return [];
}