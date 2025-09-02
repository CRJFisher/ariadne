/**
 * Def Factory - Creates Def objects from scope nodes
 * 
 * Bridges between internal scope representation and public Def type
 */

import { SyntaxNode } from 'tree-sitter';
import { 
  Def,
  DefKind,
  Location,
  Language
} from '@ariadnejs/types';
import { ScopeNode, ScopeTree, ScopeRange } from '../scope_analysis/scope_tree';

/**
 * Create a Def object from a scope node
 */
export function create_def_from_scope(
  scope: ScopeNode,
  file_path: string,
  scope_tree?: ScopeTree
): Def {
  const kind = map_scope_type_to_def_kind(scope.type);
  const name = scope.metadata?.name || get_anonymous_name(scope.type);
  
  // Create location from scope range
  const location: Location = {
    file_path,
    line: scope.range.start.row,
    column: scope.range.start.column,
    end_line: scope.range.end.row,
    end_column: scope.range.end.column
  };
  
  // Build fully qualified name
  const qualified_name = build_qualified_name(scope, scope_tree, file_path);
  
  return {
    name,
    kind,
    location,
    qualified_name,
    is_exported: scope.metadata?.is_exported || false,
    is_async: scope.metadata?.is_async || false,
    is_generator: scope.metadata?.is_generator || false,
    parent_class: get_parent_class_name(scope, scope_tree)
  };
}

/**
 * Map scope type to Def kind
 */
function map_scope_type_to_def_kind(scope_type: string): DefKind {
  switch (scope_type) {
    case 'function':
      return 'function';
    case 'class':
      return 'class';
    case 'method':
      return 'method';
    case 'module':
      return 'module';
    case 'block':
      return 'block';
    default:
      return 'other';
  }
}

/**
 * Get anonymous name for scope type
 */
function get_anonymous_name(scope_type: string): string {
  switch (scope_type) {
    case 'function':
      return '<anonymous_function>';
    case 'class':
      return '<anonymous_class>';
    case 'method':
      return '<anonymous_method>';
    case 'module':
      return '<module>';
    case 'block':
      return '<block>';
    default:
      return '<anonymous>';
  }
}

/**
 * Build fully qualified name for a scope
 */
function build_qualified_name(
  scope: ScopeNode,
  scope_tree: ScopeTree | undefined,
  file_path: string
): string {
  if (!scope_tree) {
    return scope.metadata?.name || get_anonymous_name(scope.type);
  }
  
  const parts: string[] = [];
  let current: ScopeNode | undefined = scope;
  
  // Walk up the scope tree
  while (current) {
    const name = current.metadata?.name || get_anonymous_name(current.type);
    parts.unshift(name);
    
    if (current.parent_id) {
      current = scope_tree.nodes.get(current.parent_id);
    } else {
      break;
    }
  }
  
  // Add file path as module prefix
  const module_name = file_path.replace(/\.[^.]+$/, '').replace(/\//g, '.');
  parts.unshift(module_name);
  
  return parts.join('.');
}

/**
 * Get parent class name if scope is a method
 */
function get_parent_class_name(
  scope: ScopeNode,
  scope_tree: ScopeTree | undefined
): string | undefined {
  if (!scope_tree || !scope.parent_id) {
    return undefined;
  }
  
  const parent = scope_tree.nodes.get(scope.parent_id);
  if (parent && parent.type === 'class') {
    return parent.metadata?.name;
  }
  
  return undefined;
}

/**
 * Find the AST node corresponding to a scope
 */
export function find_function_node(
  root: SyntaxNode,
  scope_range: ScopeRange
): SyntaxNode | null {
  return find_node_at_range(root, scope_range);
}

/**
 * Recursively find node at specific range
 */
function find_node_at_range(
  node: SyntaxNode,
  range: ScopeRange
): SyntaxNode | null {
  // Check if this node matches the range exactly
  if (node.startPosition.row === range.start.row &&
      node.startPosition.column === range.start.column &&
      node.endPosition.row === range.end.row &&
      node.endPosition.column === range.end.column) {
    // Check if this is a function-like node
    if (is_function_like_node(node)) {
      return node;
    }
  }
  
  // Search children recursively
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) {
      const result = find_node_at_range(child, range);
      if (result) {
        return result;
      }
    }
  }
  
  return null;
}

/**
 * Check if node is a function-like construct
 */
function is_function_like_node(node: SyntaxNode): boolean {
  const function_types = [
    // JavaScript/TypeScript
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'generator_function',
    'generator_function_declaration',
    // Python
    'function_definition',
    'lambda',
    // Rust
    'function_item',
    'closure_expression'
  ];
  
  return function_types.includes(node.type);
}

/**
 * Get enclosing class name for a scope
 */
export function get_enclosing_class_name(
  scope: ScopeNode,
  scope_tree: ScopeTree
): string | undefined {
  let current: ScopeNode | undefined = scope;
  
  // Walk up the scope tree looking for a class
  while (current) {
    if (current.type === 'class') {
      return current.metadata?.name;
    }
    
    if (current.parent_id) {
      current = scope_tree.nodes.get(current.parent_id);
    } else {
      break;
    }
  }
  
  return undefined;
}

/**
 * Create multiple Defs from a scope tree
 */
export function create_defs_from_scope_tree(
  scope_tree: ScopeTree,
  file_path: string
): Def[] {
  const defs: Def[] = [];
  
  for (const [_, scope] of scope_tree.nodes.entries()) {
    // Only create Defs for function and class scopes
    if (scope.type === 'function' || scope.type === 'class' || scope.type === 'method') {
      const def = create_def_from_scope(scope, file_path, scope_tree);
      defs.push(def);
    }
  }
  
  return defs;
}

/**
 * Find a Def by name in a list
 */
export function find_def_by_name(
  defs: Def[],
  name: string
): Def | undefined {
  return defs.find(d => d.name === name);
}

/**
 * Find all Defs of a specific kind
 */
export function find_defs_by_kind(
  defs: Def[],
  kind: DefKind
): Def[] {
  return defs.filter(d => d.kind === kind);
}