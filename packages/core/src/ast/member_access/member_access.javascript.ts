/**
 * JavaScript/TypeScript member access detection
 */

import type { SyntaxNode } from 'tree-sitter';
import { FilePath, NamespaceName, ASTNodeType, FieldName } from '@ariadnejs/types';
import { MemberAccessExpression } from './types';

// AST node types for JavaScript/TypeScript
const MEMBER_EXPRESSION: ASTNodeType = 'member_expression';
const NESTED_TYPE_IDENTIFIER: ASTNodeType = 'nested_type_identifier';
const OBJECT_FIELD: FieldName = 'object';
const PROPERTY_FIELD: FieldName = 'property';
const MODULE_FIELD: FieldName = 'module';
const NAME_FIELD: FieldName = 'name';

/**
 * Detect JavaScript/TypeScript member access expressions
 * Handles patterns like: namespace.member, object.property, and type annotations like namespace.Type
 */
export function detect_javascript_member_access(
  node: SyntaxNode,
  namespace_imports: ReadonlySet<NamespaceName>,
  file_path: FilePath
): MemberAccessExpression | null {
  // Handle runtime member access (e.g., namespace.function())
  if (node.type === MEMBER_EXPRESSION) {
    const object_node = node.childForFieldName(OBJECT_FIELD);
    const property_node = node.childForFieldName(PROPERTY_FIELD);
    
    if (!object_node || !property_node) {
      return null;
    }

    const object_name = object_node.text;
    const property_name = property_node.text;
    
    // Check if the object is a known namespace import
    if (!namespace_imports.has(object_name)) {
      return null;
    }

    return {
      namespace: object_name,
      member: property_name,
      location: {
        file_path,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1
      }
    };
  }
  
  // Handle TypeScript type annotations (e.g., namespace.Type)
  if (node.type === NESTED_TYPE_IDENTIFIER) {
    const module_node = node.childForFieldName(MODULE_FIELD);
    const name_node = node.childForFieldName(NAME_FIELD);
    
    if (!module_node || !name_node) {
      return null;
    }

    const module_name = module_node.text;
    const type_name = name_node.text;
    
    // Check if the module is a known namespace import
    if (!namespace_imports.has(module_name)) {
      return null;
    }

    return {
      namespace: module_name,
      member: type_name,
      location: {
        file_path,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
        end_line: node.endPosition.row + 1,
        end_column: node.endPosition.column + 1
      }
    };
  }
  
  return null;
}

/**
 * Check if a node could contain member access expressions
 */
export function can_contain_member_access_javascript(node: SyntaxNode): boolean {
  // Member expressions can appear in many contexts
  return node.type !== 'comment' && node.type !== 'string' && node.type !== 'template_string';
}