/**
 * Bespoke export detection utilities stub
 *
 * TODO: Implement using tree-sitter queries where applicable
 */

import { SyntaxNode } from 'tree-sitter';
import { Location } from '@ariadnejs/types';

/**
 * Convert tree-sitter node to location
 */
export function node_to_location(node: SyntaxNode): Location {
  return {
    start: {
      line: node.startPosition.row + 1,
      column: node.startPosition.column + 1
    },
    end: {
      line: node.endPosition.row + 1,
      column: node.endPosition.column + 1
    }
  };
}

/**
 * Clean module source string (remove quotes and normalize)
 */
export function clean_source(source: string): string {
  let cleaned = source.replace(/^['"`]|['"`]$/g, '');
  cleaned = cleaned.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
  return cleaned;
}

/**
 * Clean Python string literal
 */
export function clean_string(str: string): string {
  return str.replace(/^('''|"""|['"`])|(('''|"""|['"`])$)/g, '');
}

/**
 * Parse Python list literal for __all__ (stub)
 */
export function parse_all_list(node: SyntaxNode): string[] {
  // TODO: Implement using tree-sitter queries
  return [];
}

/**
 * Check if a node has a specific decorator (stub)
 */
export function has_decorator(
  node: SyntaxNode,
  decorator_names: string[]
): boolean {
  // TODO: Implement using tree-sitter queries
  return false;
}

/**
 * Extract name from node (stub)
 */
export function extract_name(node: SyntaxNode): string | null {
  // TODO: Implement using tree-sitter queries
  return null;
}

/**
 * Check if node is inside another node type (stub)
 */
export function is_inside_node_type(
  node: SyntaxNode,
  type_to_check: string
): boolean {
  // TODO: Implement using tree-sitter queries
  return false;
}

/**
 * Find child of specific type (stub)
 */
export function find_child_of_type(
  node: SyntaxNode,
  child_type: string
): SyntaxNode | null {
  // TODO: Implement using tree-sitter queries
  return null;
}

/**
 * Find children of specific type (stub)
 */
export function find_children_of_type(
  node: SyntaxNode,
  child_type: string
): SyntaxNode[] {
  // TODO: Implement using tree-sitter queries
  return [];
}

/**
 * Get visibility level from text
 */
export function get_visibility_level(text: string): string | null {
  if (text.includes('pub(crate)')) return 'crate';
  if (text.includes('pub(super)')) return 'super';
  if (text.includes('pub')) return 'public';
  return 'private';
}

/**
 * Extract use path from Rust use statement (stub)
 */
export function extract_use_path(node: SyntaxNode): {
  path: string;
  items: string[];
  is_glob: boolean;
} {
  // TODO: Implement using tree-sitter queries
  return {
    path: '',
    items: [],
    is_glob: false
  };
}

/**
 * Get function modifiers (stub)
 */
export function get_function_modifiers(node: SyntaxNode): {
  is_public: boolean;
  is_async: boolean;
  is_unsafe: boolean;
} {
  // TODO: Implement using tree-sitter queries
  return {
    is_public: false,
    is_async: false,
    is_unsafe: false
  };
}