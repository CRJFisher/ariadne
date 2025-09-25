/**
 * Scope Tree - Build hierarchical scope structure
 */

import type { Tree } from "tree-sitter";
import type {
  FilePath,
  Language,
  ScopeId,
  ScopeType,
  LexicalScope,
  Location,
  ScopeName,
} from "@ariadnejs/types";
import {
  scope_string,
  module_scope,
  function_scope as create_function_scope,
  class_scope as create_class_scope,
  block_scope,
} from "@ariadnejs/types";
import { node_to_location } from "../node_utils";
import { location_contains } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../parse_and_query_code/capture_types";
import { SemanticEntity } from "../../parse_and_query_code/capture_types";

/**
 * Map semantic entity to scope type
 */
export function map_entity_to_scope_type(entity: SemanticEntity): ScopeType {
  switch (entity) {
    case SemanticEntity.MODULE:
      return "module";
    case SemanticEntity.CLASS:
      return "class";
    case SemanticEntity.FUNCTION:
      return "function";
    case SemanticEntity.METHOD:
      return "method";
    case SemanticEntity.CONSTRUCTOR:
      return "constructor";
    case SemanticEntity.BLOCK:
      return "block";
    default:
      return "block";
  }
}

/**
 * Build hierarchical scope tree from captures
 */
export function build_scope_tree(
  scope_captures: NormalizedCapture[],
  tree: Tree,
  file_path: FilePath,
  language: Language
): {
  root_scope: LexicalScope;
  scopes: Map<ScopeId, LexicalScope>;
} {
  // Sort by start position to process in order
  const sorted_captures = [...scope_captures].sort((a, b) => {
    if (a.node_location.line !== b.node_location.line) {
      return a.node_location.line - b.node_location.line;
    }
    return a.node_location.column - b.node_location.column;
  });

  const scopes = new Map<ScopeId, LexicalScope>();

  // Create root scope (module)
  const root_location = node_to_location(tree.rootNode, file_path);
  const root_scope_id = module_scope(root_location);
  const root_scope: LexicalScope = {
    id: root_scope_id,
    parent_id: null,
    name: null, // TODO: Add support for scope names.
    type: "module",
    location: root_location,
    child_ids: [],
    symbols: new Map(),
  };

  scopes.set(root_scope_id, root_scope);

  // Process each scope capture
  for (const capture of sorted_captures) {
    if (capture.entity === SemanticEntity.MODULE) continue; // Skip root

    const location = capture.node_location;
    const scope_type = map_entity_to_scope_type(capture.entity);

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
    const current_root = scopes.get(root_scope_id)!;
    const parent = find_containing_scope(location, current_root, scopes);

    // Create the scope with parent reference
    const scope: LexicalScope = {
      id: scope_id,
      parent_id: parent.id,
      name: null, // TODO: Add support for scope names. So far only Typescript populates CaptureContext.method_name. CaptureContext.function_name and .class_name aren't even defined
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

    scopes.set(scope_id, scope);
  }

  // Return the root scope from the scopes map to ensure consistency
  const final_root_scope = scopes.get(root_scope_id)!;
  return { root_scope: final_root_scope, scopes };
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
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  while (current_id && !visited.has(current_id)) {
    visited.add(current_id);
    const parent = scopes.get(current_id);
    if (parent) {
      depth++;
      current_id = parent.parent_id;
    } else {
      // Parent doesn't exist in scopes map, stop traversing
      break;
    }
  }
  return depth;
}

/**
 * Helper to find containing scope
 */
export function find_containing_scope(
  node_location: Location,
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope {
  // Find deepest scope that contains this node
  let best_scope = root_scope;
  let best_depth = 0;

  for (const scope of Array.from(scopes.values())) {
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
