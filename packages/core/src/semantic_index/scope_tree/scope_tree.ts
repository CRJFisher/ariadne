/**
 * Scope Tree - Build hierarchical scope structure
 */

import type { SyntaxNode, Tree } from "tree-sitter";
import type {
  FilePath,
  Language,
  Location,
  ScopeId,
  ScopeType,
  LexicalScope,
} from "@ariadnejs/types";
import {
  scope_string,
  module_scope,
  function_scope as create_function_scope,
  class_scope as create_class_scope,
  block_scope,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import { location_contains } from "@ariadnejs/types/src/common";
import type { SemanticCapture } from "../types";

/**
 * Build hierarchical scope tree from captures
 */
export function build_scope_tree(
  scope_captures: SemanticCapture[],
  tree: Tree,
  file_path: FilePath,
  _language: Language
): {
  root_scope: LexicalScope;
  scopes: Map<ScopeId, LexicalScope>;
  node_to_scope: Map<SyntaxNode, LexicalScope>;
} {
  // Sort by start position to process in order
  const sorted_captures = [...scope_captures].sort(
    (a, b) => a.node.startIndex - b.node.startIndex
  );

  const scopes = new Map<ScopeId, LexicalScope>();
  const node_to_scope = new Map<SyntaxNode, LexicalScope>();

  // Create root scope (module)
  const root_location = node_to_location(tree.rootNode, file_path);
  const root_scope_id = module_scope(root_location);
  const root_scope: LexicalScope = {
    id: root_scope_id,
    parent_id: null,
    name: null,
    type: "module" as ScopeType,
    location: root_location,
    child_ids: [],
    symbols: new Map(),
  };

  scopes.set(root_scope_id, root_scope);
  node_to_scope.set(tree.rootNode, root_scope);

  // Process each scope capture
  for (const capture of sorted_captures) {
    if (capture.subcategory === "module") continue; // Skip root

    const location = node_to_location(capture.node, file_path);
    const scope_type = capture.subcategory as ScopeType;

    // Create scope ID based on type
    let scope_id: ScopeId;

    switch (scope_type) {
      case "function":
      case "method":
      case "constructor":
        scope_id = create_function_scope(location);
        break;
      case "class":
        scope_id = create_class_scope(location);
        break;
      case "block":
        scope_id = block_scope(location);
        break;
      default:
        scope_id = scope_string({ type: scope_type, location });
    }

    // Find parent scope using position containment
    const parent = find_containing_scope(capture.node, root_scope, scopes, file_path);

    // Create the scope with parent reference
    const scope: LexicalScope = {
      id: scope_id,
      parent_id: parent.id,
      name: null,
      type: scope_type,
      location,
      child_ids: [],
      symbols: new Map(),
    };

    // Update parent's child IDs (recreate parent with new child list)
    const updated_parent: LexicalScope = {
      ...parent,
      child_ids: [...parent.child_ids, scope_id],
    };
    scopes.set(parent.id, updated_parent);

    // If parent is root, update root_scope reference
    if (parent.id === root_scope.id) {
      Object.assign(root_scope, updated_parent);
    }

    scopes.set(scope_id, scope);
    node_to_scope.set(capture.node, scope);
  }

  return { root_scope, scopes, node_to_scope };
}

/**
 * Helper to compute scope depth
 */
export function compute_scope_depth(
  scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): number {
  let depth = 0;
  let current_id = scope.parent_id;
  while (current_id) {
    depth++;
    const parent = scopes.get(current_id);
    current_id = parent?.parent_id || null;
  }
  return depth;
}

/**
 * Helper to find containing scope
 */
export function find_containing_scope(
  node: SyntaxNode,
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LexicalScope {
  const node_location = node_to_location(node, file_path);

  // Find deepest scope that contains this node
  let best_scope = root_scope;
  let best_depth = 0;

  for (const scope of scopes.values()) {
    if (location_contains(scope.location, node_location)) {
      const depth = compute_scope_depth(scope, scopes);
      if (depth > best_depth) {
        best_scope = scope;
        best_depth = depth;
      }
    }
  }

  return best_scope;
}