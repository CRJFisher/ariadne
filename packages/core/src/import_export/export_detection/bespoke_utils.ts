/**
 * Shared utilities for bespoke export detection handlers
 * 
 * Common functions used across multiple language-specific handlers
 * to reduce code duplication
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
  // Remove quotes
  let cleaned = source.replace(/^['"`]|['"`]$/g, '');
  
  // Normalize .js/.ts extensions
  cleaned = cleaned.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
  
  return cleaned;
}

/**
 * Clean Python string literal
 */
export function clean_string(str: string): string {
  // Remove quotes (single, double, triple)
  return str.replace(/^('''|"""|['"`])|(('''|"""|['"`])$)/g, '');
}

/**
 * Parse Python list literal for __all__
 */
export function parse_all_list(node: SyntaxNode): string[] {
  const names: string[] = [];
  
  if (node.type === 'list') {
    for (const child of node.children) {
      if (child.type === 'string') {
        names.push(clean_string(child.text));
      } else if (child.type === 'concatenated_string') {
        // Handle concatenated strings
        for (const part of child.children) {
          if (part.type === 'string') {
            names.push(clean_string(part.text));
          }
        }
      }
    }
  } else if (node.type === 'list_comprehension') {
    // For list comprehensions, we can't statically determine the values
    // Mark as dynamic
    names.push('<dynamic>');
  } else if (node.type === 'binary_operator' && node.text.includes('+')) {
    // Handle list concatenation
    for (const child of node.children) {
      if (child.type === 'list') {
        names.push(...parse_all_list(child));
      }
    }
  }
  
  return names;
}

/**
 * Check if a node has a specific decorator
 */
export function has_decorator(
  node: SyntaxNode,
  decorator_names: string[]
): boolean {
  // Look for decorator nodes as siblings or children
  const decorators = node.parent?.children.filter(
    c => c.type === 'decorator' && c.endPosition.row < node.startPosition.row
  ) || [];
  
  for (const decorator of decorators) {
    const text = decorator.text;
    if (decorator_names.some(name => text.includes(name))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract name from various node types
 */
export function extract_name(node: SyntaxNode): string | null {
  // Try common field names
  const name_fields = ['name', 'identifier', 'key', 'property'];
  
  for (const field of name_fields) {
    const name_node = node.childForFieldName(field);
    if (name_node) {
      return name_node.text;
    }
  }
  
  // For shorthand properties, the node itself is the name
  if (node.type === 'shorthand_property_identifier' || 
      node.type === 'identifier') {
    return node.text;
  }
  
  return null;
}

/**
 * Check if a node is inside a specific parent type
 */
export function is_inside_node_type(
  node: SyntaxNode,
  parent_type: string
): boolean {
  let current = node.parent;
  while (current) {
    if (current.type === parent_type) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Find first child of specific type
 */
export function find_child_of_type(
  node: SyntaxNode,
  type: string
): SyntaxNode | null {
  for (const child of node.children) {
    if (child.type === type) {
      return child;
    }
  }
  return null;
}

/**
 * Find all children of specific type
 */
export function find_children_of_type(
  node: SyntaxNode,
  type: string
): SyntaxNode[] {
  return node.children.filter(c => c.type === type);
}

/**
 * Check if text matches a visibility pattern (Rust)
 */
export function get_visibility_level(text: string): string | null {
  if (text.startsWith('pub(crate)')) return 'crate';
  if (text.startsWith('pub(super)')) return 'super';
  if (text.startsWith('pub(self)')) return 'self';
  if (text.match(/^pub\(in\s+([^)]+)\)/)) {
    const match = text.match(/^pub\(in\s+([^)]+)\)/);
    return `in ${match![1]}`;
  }
  if (text.startsWith('pub ') || text === 'pub') return 'public';
  return null;
}

/**
 * Extract module path from use statement (Rust)
 */
export function extract_use_path(node: SyntaxNode): {
  module_path: string;
  items: string[];
  has_glob: boolean;
} {
  const result = {
    module_path: '',
    items: [] as string[],
    has_glob: false
  };
  
  // Find use_declaration or scoped_use_list
  const use_tree = find_child_of_type(node, 'use_tree') ||
                   find_child_of_type(node, 'scoped_use_list');
  
  if (!use_tree) {
    // Simple case: extract from node text
    const match = node.text.match(/use\s+([^;{]+)/);
    if (match) {
      result.module_path = match[1].trim();
      result.has_glob = result.module_path.includes('*');
    }
    return result;
  }
  
  // Complex case: parse the tree
  const visit = (n: SyntaxNode, path: string = '') => {
    if (n.type === 'scoped_identifier') {
      const parts: string[] = [];
      for (const child of n.children) {
        if (child.type === 'identifier') {
          parts.push(child.text);
        }
      }
      result.module_path = parts.join('::');
    } else if (n.type === 'use_wildcard') {
      result.has_glob = true;
    } else if (n.type === 'use_list') {
      for (const child of n.children) {
        if (child.type === 'scoped_identifier' || child.type === 'identifier') {
          result.items.push(child.text);
        }
      }
    }
    
    for (const child of n.children) {
      visit(child, path);
    }
  };
  
  visit(use_tree);
  return result;
}

/**
 * Check if a function is async or generator
 */
export function get_function_modifiers(node: SyntaxNode): {
  is_async: boolean;
  is_generator: boolean;
  is_unsafe?: boolean;
} {
  const modifiers = {
    is_async: false,
    is_generator: false,
    is_unsafe: false
  };
  
  const text = node.text.substring(0, 100);
  
  // Check for async
  if (text.includes('async ') || node.children.some(c => c.type === 'async')) {
    modifiers.is_async = true;
  }
  
  // Check for generator (JavaScript/Python)
  if (text.includes('function*') || node.type === 'generator_function_declaration') {
    modifiers.is_generator = true;
  }
  
  // Check for unsafe (Rust)
  if (text.includes('unsafe ')) {
    modifiers.is_unsafe = true;
  }
  
  return modifiers;
}