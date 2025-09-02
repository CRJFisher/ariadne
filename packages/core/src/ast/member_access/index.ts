/**
 * Member access expression detection module
 * 
 * Detects namespace member access patterns across different languages
 * e.g., namespace.member, module.function, object.property
 */

import type { SyntaxNode } from 'tree-sitter';
import { Language, FileAnalysis, NamespaceName } from '@ariadnejs/types';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { traverse_for_member_access } from './member_access';

/**
 * Find all member access expressions in a file's AST
 * 
 * @param analysis - The file analysis containing imports and metadata
 * @param root_node - The root AST node to traverse
 * @returns Array of detected member access expressions
 * 
 * @example
 * // TypeScript: import * as types from './types';
 * // Code: const user: types.User = {};
 * // Returns: [{ namespace: 'types', member: 'User', location: ... }]
 */
export function find_member_access_expressions(
  analysis: FileAnalysis,
  root_node: SyntaxNode
): MemberAccessExpression[] {
  const member_accesses: MemberAccessExpression[] = [];
  
  // Build set of namespace imports from the file analysis
  const namespace_imports = new Set<NamespaceName>();
  for (const import_stmt of analysis.imports) {
    if (import_stmt.is_namespace_import && import_stmt.namespace_name) {
      namespace_imports.add(import_stmt.namespace_name);
    }
  }
  
  // Create context for traversal
  const context: MemberAccessContext = {
    file_path: analysis.file_path,
    namespace_imports
  };
  
  // Traverse AST to find member access patterns
  traverse_for_member_access(
    root_node,
    analysis.language,
    context,
    member_accesses
  );
  
  return member_accesses;
}
