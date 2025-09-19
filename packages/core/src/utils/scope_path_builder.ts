/**
 * Scope Path Builder
 * 
 * Utilities for extracting hierarchical scope paths from the scope tree.
 * These paths are used to construct globally unique symbols for entities.
 */

import { ScopeNode, ScopeTree, ScopeId } from '@ariadnejs/types';

/**
 * Build scope path from a scope node to root
 * 
 * Returns an array of scope names from root to the parent of the given scope.
 * Does not include the scope itself or the global scope.
 * 
 * @example
 * // For a method in a class
 * build_scope_path(method_scope, tree) // Returns ['MyClass']
 * 
 * // For a nested function
 * build_scope_path(inner_func_scope, tree) // Returns ['outerFunc']
 */
export function build_scope_path(
  scope: ScopeNode,
  tree: ScopeTree
): string[] {
  const path: string[] = [];
  let current = scope;
  
  // Walk up the tree collecting parent scope names
  while (current.parent_id) {
    const parent = tree.nodes.get(current.parent_id);
    if (!parent) break;
    
    // Add named scopes (skip global and anonymous blocks)
    if (parent.name && parent.type !== 'global') {
      path.unshift(parent.name);
    }
    current = parent;
  }
  
  return path;
}

/**
 * Build full scope path including the scope itself
 * 
 * @example
 * build_full_scope_path(method_scope, tree) // Returns ['MyClass', 'myMethod']
 */
export function build_full_scope_path(
  scope: ScopeNode,
  tree: ScopeTree
): string[] {
  const path = build_scope_path(scope, tree);
  
  // Add the scope's own name if it has one
  if (scope.name) {
    path.push(scope.name);
  }
  
  return path;
}

/**
 * Get the immediate parent scope name
 * 
 * @example
 * get_parent_scope_name(method_scope, tree) // Returns 'MyClass'
 */
export function get_parent_scope_name(
  scope: ScopeNode,
  tree: ScopeTree
): string | undefined {
  if (!scope.parent_id) return undefined;
  
  const parent = tree.nodes.get(scope.parent_id);
  return parent?.name;
}

/**
 * Find the containing class scope for a given scope
 * 
 * @example
 * find_containing_class(method_scope, tree) // Returns class scope node
 */
export function find_containing_class(
  scope: ScopeNode,
  tree: ScopeTree
): ScopeNode | undefined {
  let current: ScopeNode | undefined = scope;
  
  while (current) {
    if (current.type === 'class') {
      return current;
    }
    
    if (!current.parent_id) break;
    current = tree.nodes.get(current.parent_id);
  }
  
  return undefined;
}

/**
 * Find the containing function scope for a given scope
 */
export function find_containing_function(
  scope: ScopeNode,
  tree: ScopeTree
): ScopeNode | undefined {
  let current: ScopeNode | undefined = scope;
  
  while (current) {
    if (current.type === 'function') {
      return current;
    }
    
    if (!current.parent_id) break;
    current = tree.nodes.get(current.parent_id);
  }
  
  return undefined;
}

/**
 * Check if a scope is nested within another scope
 */
export function is_scope_nested_in(
  child_scope: ScopeNode,
  parent_scope_id: ScopeId,
  tree: ScopeTree
): boolean {
  let current: ScopeNode | undefined = child_scope;
  
  while (current) {
    if (current.id === parent_scope_id) {
      return true;
    }
    
    if (!current.parent_id) break;
    current = tree.nodes.get(current.parent_id);
  }
  
  return false;
}

/**
 * Get the depth of a scope in the tree
 * 
 * Global scope has depth 0, its children have depth 1, etc.
 */
export function get_scope_depth(
  scope: ScopeNode,
  tree: ScopeTree
): number {
  let depth = 0;
  let current: ScopeNode | undefined = scope;
  
  while (current.parent_id) {
    depth++;
    current = tree.nodes.get(current.parent_id);
    if (!current) break;
  }
  
  return depth;
}

/**
 * Build a human-readable scope path string
 * 
 * @example
 * format_scope_path(method_scope, tree) // Returns "MyClass::myMethod"
 */
export function format_scope_path(
  scope: ScopeNode,
  tree: ScopeTree,
  separator: string = '::'
): string {
  const path = build_full_scope_path(scope, tree);
  return path.join(separator);
}