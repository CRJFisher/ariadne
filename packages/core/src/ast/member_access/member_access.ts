/**
 * Member access detection stub
 *
 * TODO: Implement using tree-sitter queries from member_access_queries/*.scm
 */

import type { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, NamespaceName, FileAnalysis } from '@ariadnejs/types';
import { MemberAccessExpression, MemberAccessContext } from './types';

/**
 * Find all member access expressions in a file's AST
 */
export function find_member_access_expressions(
  analysis: FileAnalysis,
  root_node: SyntaxNode
): MemberAccessExpression[] {
  // TODO: Implement using tree-sitter queries from member_access_queries/*.scm
  return [];
}