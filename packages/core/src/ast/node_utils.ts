/**
 * AST node utility functions
 * 
 * Provides helpers for working with tree-sitter AST nodes
 */

import { SyntaxNode } from 'tree-sitter';
import { SimpleRange, Point } from '@ariadnejs/types';

/**
 * Convert a tree-sitter node to a SimpleRange
 */
export function node_to_range(node: SyntaxNode): SimpleRange {
  return {
    start: {
      row: node.startPosition.row,
      column: node.startPosition.column
    },
    end: {
      row: node.endPosition.row,
      column: node.endPosition.column
    }
  };
}

/**
 * Check if a point is within a range
 */
export function point_in_range(point: Point, range: SimpleRange): boolean {
  if (point.row < range.start.row || point.row > range.end.row) {
    return false;
  }
  
  if (point.row === range.start.row && point.column < range.start.column) {
    return false;
  }
  
  if (point.row === range.end.row && point.column > range.end.column) {
    return false;
  }
  
  return true;
}

/**
 * Check if two ranges overlap
 */
export function ranges_overlap(range1: SimpleRange, range2: SimpleRange): boolean {
  // Check if range1 ends before range2 starts
  if (range1.end.row < range2.start.row ||
      (range1.end.row === range2.start.row && range1.end.column < range2.start.column)) {
    return false;
  }
  
  // Check if range2 ends before range1 starts
  if (range2.end.row < range1.start.row ||
      (range2.end.row === range1.start.row && range2.end.column < range1.start.column)) {
    return false;
  }
  
  return true;
}

/**
 * Get the text content of a node from source
 */
export function get_node_text(node: SyntaxNode, source: string): string {
  return source.substring(node.startIndex, node.endIndex);
}

/**
 * Find the first parent node matching a type
 */
export function find_parent_of_type(
  node: SyntaxNode | null,
  type: string | string[]
): SyntaxNode | null {
  const types = Array.isArray(type) ? type : [type];
  
  while (node) {
    if (types.includes(node.type)) {
      return node;
    }
    node = node.parent;
  }
  
  return null;
}

/**
 * Find all child nodes matching a type
 */
export function find_children_of_type(
  node: SyntaxNode,
  type: string | string[]
): SyntaxNode[] {
  const types = Array.isArray(type) ? type : [type];
  const children: SyntaxNode[] = [];
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && types.includes(child.type)) {
      children.push(child);
    }
  }
  
  return children;
}

/**
 * Walk the AST tree and call callback for each node
 */
export function walk_tree(
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void | boolean
): void {
  const shouldContinue = callback(node);
  
  // If callback returns false, stop walking this branch
  if (shouldContinue === false) {
    return;
  }
  
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      walk_tree(child, callback);
    }
  }
}

/**
 * Get the enclosing function or method node for a given node
 */
export function get_enclosing_function(node: SyntaxNode | null): SyntaxNode | null {
  const functionTypes = [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'function_definition',
    'lambda'
  ];
  
  return find_parent_of_type(node, functionTypes);
}

/**
 * Check if a node is an identifier
 */
export function is_identifier(node: SyntaxNode): boolean {
  return node.type === 'identifier' || node.type === 'property_identifier';
}

/**
 * Get all identifiers in a node
 */
export function get_identifiers(node: SyntaxNode): SyntaxNode[] {
  const identifiers: SyntaxNode[] = [];
  
  walk_tree(node, (n) => {
    if (is_identifier(n)) {
      identifiers.push(n);
    }
  });
  
  return identifiers;
}