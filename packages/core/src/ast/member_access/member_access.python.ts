/**
 * Python member access detection
 */

import type { SyntaxNode } from 'tree-sitter';
import { FilePath, NamespaceName, ASTNodeType, FieldName } from '@ariadnejs/types';
import { MemberAccessExpression } from './types';

// AST node types for Python
const ATTRIBUTE: ASTNodeType = 'attribute';
const OBJECT_FIELD: FieldName = 'object';
const ATTRIBUTE_FIELD: FieldName = 'attribute';

/**
 * Detect Python member access expressions
 * Handles patterns like: module.function, module.Class, object.attribute
 */
export function detect_python_member_access(
  node: SyntaxNode,
  namespace_imports: ReadonlySet<NamespaceName>,
  file_path: FilePath
): MemberAccessExpression | null {
  if (node.type !== ATTRIBUTE) {
    return null;
  }

  const value_node = node.childForFieldName(OBJECT_FIELD);
  const attr_node = node.childForFieldName(ATTRIBUTE_FIELD);
  
  if (!value_node || !attr_node) {
    return null;
  }

  const object_name = value_node.text;
  const attr_name = attr_node.text;
  
  // Check if the object is a known namespace import
  if (!namespace_imports.has(object_name)) {
    return null;
  }

  return {
    namespace: object_name,
    member: attr_name,
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
export function can_contain_member_access_python(node: SyntaxNode): boolean {
  // Attribute access can appear in many contexts
  return node.type !== 'comment' && node.type !== 'string';
}