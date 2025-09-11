/**
 * Generic member access detection processor
 * 
 * Configuration-driven member access detection that handles ~85% of member access logic
 * Language-specific features are handled by bespoke modules
 */

import type { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, NamespaceName, FileAnalysis, ASTNodeType } from '@ariadnejs/types';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { 
  getMemberAccessConfig, 
  isMemberAccessNode, 
  getMemberAccessFields, 
  shouldSkipNode 
} from './language_configs';
import { node_to_location } from '../node_utils';

// Import bespoke handlers for special cases
import { handle_javascript_optional_chaining, handle_javascript_computed_access } from './member_access.javascript';
import { handle_python_getattr } from './member_access.python';
import { handle_rust_field_expression } from './member_access.rust';

/**
 * Find all member access expressions in a file's AST (main entry point)
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
      namespace_imports.add(import_stmt.namespace_name as NamespaceName);
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

/**
 * Traverse AST to find all member access expressions
 */
function traverse_for_member_access(
  node: SyntaxNode,
  language: Language,
  context: MemberAccessContext,
  accesses: MemberAccessExpression[]
): void {
  if (!node) return;
  
  // Try to detect member access at this node
  const detected = detect_member_access_at_node(node, language, context);
  if (detected) {
    accesses.push(detected);
  }
  
  // Check if we should traverse children
  if (!shouldSkipNode(node.type as ASTNodeType, language)) {
    // Recursively traverse children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse_for_member_access(child, language, context, accesses);
      }
    }
  }
}

/**
 * Detect member access at a specific node using configuration
 */
function detect_member_access_at_node(
  node: SyntaxNode,
  language: Language,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Try configuration-driven detection first (handles ~85% of cases)
  const config_result = detect_member_access_with_config(node, language, context);
  if (config_result) {
    return config_result;
  }
  
  // Fall back to language-specific bespoke handlers for special cases
  switch (language) {
    case 'javascript':
    case 'typescript':
      // Handle optional chaining (?.)
      const optional_result = handle_javascript_optional_chaining(node, context);
      if (optional_result) return optional_result;
      
      // Handle computed access (obj[prop])
      const computed_result = handle_javascript_computed_access(node, context);
      if (computed_result) return computed_result;
      break;
      
    case 'python':
      // Handle getattr() calls
      const getattr_result = handle_python_getattr(node, context);
      if (getattr_result) return getattr_result;
      break;
      
    case 'rust':
      // Handle field expressions (struct.field)
      const field_result = handle_rust_field_expression(node, context);
      if (field_result) return field_result;
      break;
  }
  
  return null;
}

/**
 * Configuration-driven member access detection
 * Handles the common cases across all languages
 */
function detect_member_access_with_config(
  node: SyntaxNode,
  language: Language,
  context: MemberAccessContext
): MemberAccessExpression | null {
  // Check if this node type represents member access
  if (!isMemberAccessNode(node.type as ASTNodeType, language)) {
    return null;
  }
  
  // Get field mappings for this node type
  const fields = getMemberAccessFields(node.type as ASTNodeType, language);
  if (!fields) {
    return null;
  }
  
  // Extract object and member nodes
  const object_node = node.childForFieldName(fields.object_field);
  const member_node = node.childForFieldName(fields.member_field);
  
  if (!object_node || !member_node) {
    return null;
  }
  
  const object_name = object_node.text;
  const member_name = member_node.text;
  
  // Check if the object is a known namespace import
  if (!context.namespace_imports.has(object_name as NamespaceName)) {
    return null;
  }
  
  // Create and return the member access expression
  return {
    namespace: object_name as NamespaceName,
    member: member_name,
    location: node_to_location(node, context.file_path)
  };
}