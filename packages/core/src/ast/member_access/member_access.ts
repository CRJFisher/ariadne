/**
 * Common member access detection logic
 */

import type { SyntaxNode } from 'tree-sitter';
import { Language, FilePath, NamespaceName } from '@ariadnejs/types';
import { MemberAccessExpression, MemberAccessContext } from './types';
import { detect_javascript_member_access, can_contain_member_access_javascript } from './member_access.javascript';
import { detect_python_member_access, can_contain_member_access_python } from './member_access.python';
import { detect_rust_member_access, can_contain_member_access_rust } from './member_access.rust';

/**
 * Traverse AST to find all member access expressions
 */
export function traverse_for_member_access(
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
  if (should_traverse_children(node, language)) {
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
 * Detect member access at a specific node based on language
 */
function detect_member_access_at_node(
  node: SyntaxNode,
  language: Language,
  context: MemberAccessContext
): MemberAccessExpression | null {
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx':
      return detect_javascript_member_access(node, context.namespace_imports, context.file_path);
      
    case 'python':
      return detect_python_member_access(node, context.namespace_imports, context.file_path);
      
    case 'rust':
      return detect_rust_member_access(node, context.namespace_imports, context.file_path);
      
    default:
      return null;
  }
}

/**
 * Determine if we should traverse children of this node
 */
function should_traverse_children(node: SyntaxNode, language: Language): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx':
      return can_contain_member_access_javascript(node);
      
    case 'python':
      return can_contain_member_access_python(node);
      
    case 'rust':
      return can_contain_member_access_rust(node);
      
    default:
      return true; // Default to traversing for unknown languages
  }
}