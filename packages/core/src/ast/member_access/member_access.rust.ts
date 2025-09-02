/**
 * Rust member access detection
 */

import type { SyntaxNode } from 'tree-sitter';
import { FilePath, NamespaceName, ASTNodeType, FieldName } from '@ariadnejs/types';
import { MemberAccessExpression } from './types';

// AST node types for Rust
const SCOPED_IDENTIFIER: ASTNodeType = 'scoped_identifier';
const PATH_FIELD: FieldName = 'path';
const NAME_FIELD: FieldName = 'name';

/**
 * Detect Rust member access expressions
 * Handles patterns like: module::item, crate::module::Type
 */
export function detect_rust_member_access(
  node: SyntaxNode,
  namespace_imports: ReadonlySet<NamespaceName>,
  file_path: FilePath
): MemberAccessExpression | null {
  if (node.type !== SCOPED_IDENTIFIER) {
    return null;
  }

  const path_node = node.childForFieldName(PATH_FIELD);
  const name_node = node.childForFieldName(NAME_FIELD);
  
  if (!path_node || !name_node) {
    return null;
  }

  const path_name = path_node.text;
  const item_name = name_node.text;
  
  // Check if the path is a known namespace import
  if (!namespace_imports.has(path_name)) {
    return null;
  }

  return {
    namespace: path_name,
    member: item_name,
    location: {
      file_path,
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1,
      end_line: node.endPosition.row + 1,
      end_column: node.endPosition.column + 1
    }
  };
}

/**
 * Check if a node could contain member access expressions
 */
export function can_contain_member_access_rust(node: SyntaxNode): boolean {
  // Scoped identifiers can appear in many contexts
  return node.type !== 'comment' && node.type !== 'string_literal';
}