/**
 * Scope tree implementation using tree-sitter queries
 */

import { SyntaxNode, Query } from "tree-sitter";
import {
  Language,
  ScopeTree,
  FilePath,
  Location,
  RootScopeNode,
  ChildScopeNode,
  ScopeId,
  global_scope,
  module_scope,
  function_scope,
  class_scope,
  block_scope,
  local_scope,
  ScopeNode,
  ScopeName,
  ScopeType,
} from "@ariadnejs/types";
import { node_to_location } from "../../ast/node_utils";
import { load_scope_query, get_language_parser } from "./loader";
import { location_contains } from "@ariadnejs/types/src/common";

/**
 * Determine whether a file should have module or global scope based on language and content
 *
 * @param root - The root AST node of the file
 * @param language - The programming language
 * @returns The appropriate scope type for the file's root scope
 */
function determine_root_scope_type(language: Language): "module" | "global" {
  switch (language) {
    case "python":
    case "rust":
      return "module";

    case "typescript":
      return "module";

    case "javascript":
      // TODO: Use tree-sitter query to detect import/export statements
      return "global";

    // C/C++ and other languages default to global scope
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Build scope tree using tree-sitter queries
 */
/**
 * Helper function to determine if one AST node contains another
 */
function contains_node(parent: SyntaxNode, child: SyntaxNode): boolean {
  return (
    parent.startIndex <= child.startIndex && parent.endIndex >= child.endIndex
  );
}

/**
 * Find the parent scope for a given AST node
 */
function find_parent_scope(
  node: SyntaxNode,
  scope_nodes: Array<{ node: SyntaxNode; id: ScopeId }>,
  root_id: ScopeId
): ScopeId {
  // Find the smallest scope that contains this node
  let parent_scope: { node: SyntaxNode; id: ScopeId } | null = null;

  for (const scope of scope_nodes) {
    // Skip if this is the same node
    if (scope.node === node) continue;

    // Check if this scope contains our node
    if (contains_node(scope.node, node)) {
      // If we haven't found a parent yet, or this scope is smaller than our current parent
      if (!parent_scope || contains_node(parent_scope.node, scope.node)) {
        parent_scope = scope;
      }
    }
  }

  return parent_scope ? parent_scope.id : root_id;
}

export function build_scope_tree(
  root: SyntaxNode,
  file_path: FilePath,
  language: Language
): ScopeTree {
  const node_location = node_to_location(root, file_path);

  // Determine whether this file uses module or global scope
  const scope_type = determine_root_scope_type(language);
  const root_id =
    scope_type === "module"
      ? module_scope(node_location)
      : global_scope(node_location);

  // Track all scope nodes for parent resolution
  const scope_nodes: Array<{ node: SyntaxNode; id: ScopeId }> = [];

  // Collect all scopes with their AST nodes
  const all_scopes: Array<{
    node: SyntaxNode;
    id: ScopeId;
    name: ScopeName | null;
    type: ScopeType;
    location: Location;
  }> = [];

  // Collect all definition nodes (for extracting names)
  const definition_nodes: Map<SyntaxNode, string> = new Map();

  // Load and execute the scope query for this language
  const query_string = load_scope_query(language);

  if (query_string) {
    try {
      // Get the parser for this language to create the Query object
      const parser = get_language_parser(language);
      const query = new Query(parser.getLanguage(), query_string);

      // Execute the query on the AST
      const matches = query.matches(root);

      // First pass: collect all scopes and definitions
      for (const match of matches) {
        for (const capture of match.captures) {
          const captured_node = capture.node;
          const capture_name = capture.name; //query.captureNames[capture.index];

          // Capture definitions for name extraction
          if (capture_name.includes("definition.function") ||
              capture_name.includes("definition.class") ||
              capture_name.includes("definition.method") ||
              capture_name.includes("definition.generator")) {
            // Store the identifier text with its parent node (the declaration)
            if (captured_node.parent) {
              definition_nodes.set(captured_node.parent, captured_node.text);
            }
          }

          if (capture_name === "local.scope") {
            // Determine scope type based on the node type
            let scope_type_from_capture: ScopeType;

            switch (captured_node.type) {
              case "function_declaration":
              case "function_expression":
              case "arrow_function":
              case "generator_function_declaration":
                scope_type_from_capture = "function";
                break;
              case "method_definition":
                scope_type_from_capture = "method";
                break;
              case "class_body":
                scope_type_from_capture = "class";
                break;
              case "statement_block":
              case "for_statement":
              case "for_in_statement":
              case "switch_case":
              case "catch_clause":
                scope_type_from_capture = "block";
                break;
              default:
                scope_type_from_capture = "local";
            }

            // Create scope ID based on location and type
            const scope_location = node_to_location(captured_node, file_path);
            let scope_id: ScopeId;
            let scope_name: ScopeName | null = null;

            switch (scope_type_from_capture) {
              case "function":
                scope_id = function_scope(scope_location);
                // Look up the name from the definition nodes
                const func_name = definition_nodes.get(captured_node);
                // Try to find the identifier child if not found
                if (!func_name && captured_node.type === "function_declaration") {
                  const id_node = captured_node.childForFieldName("name");
                  scope_name = id_node ? (id_node.text as ScopeName) : null;
                } else {
                  scope_name = func_name ? (func_name as ScopeName) : null;
                }
                break;
              case "method":
                scope_id = function_scope(scope_location); // Methods use function scope type
                // Try to find the method name
                if (captured_node.type === "method_definition") {
                  const id_node = captured_node.childForFieldName("name");
                  scope_name = id_node ? (id_node.text as ScopeName) : null;
                }
                break;
              case "class":
                scope_id = class_scope(scope_location);
                // Look up the name from the definition nodes
                const class_name = definition_nodes.get(captured_node);
                // Try to find the identifier child if not found
                if (!class_name && (captured_node.type === "class_declaration" || captured_node.type === "class_body")) {
                  const parent = captured_node.type === "class_body" ? captured_node.parent : captured_node;
                  if (parent) {
                    const id_node = parent.childForFieldName("name");
                    scope_name = id_node ? (id_node.text as ScopeName) : null;
                  }
                } else {
                  scope_name = class_name ? (class_name as ScopeName) : null;
                }
                break;
              case "block":
                scope_id = block_scope(scope_location);
                break;
              default:
                scope_id = local_scope(scope_location);
            }

            all_scopes.push({
              node: captured_node,
              id: scope_id,
              type: scope_type_from_capture,
              location: scope_location,
              name: scope_name,
            });

            scope_nodes.push({ node: captured_node, id: scope_id });
          }
        }
      }
    } catch (e) {
      // Query parsing/execution failed, return minimal tree
      console.warn(`Failed to execute scope query for ${language}:`, e);
    }
  }

  // Second pass: determine parent-child relationships
  const parent_child_map = new Map<ScopeId, ScopeId[]>();
  parent_child_map.set(root_id, []);

  for (const scope of all_scopes) {
    const parent_id = find_parent_scope(scope.node, scope_nodes, root_id);

    // Add this scope to its parent's children
    const siblings = parent_child_map.get(parent_id) || [];
    siblings.push(scope.id);
    parent_child_map.set(parent_id, siblings);

    // Initialize this scope's children array
    if (!parent_child_map.has(scope.id)) {
      parent_child_map.set(scope.id, []);
    }
  }

  // Now build the immutable nodes with complete parent-child relationships
  const nodes = new Map<ScopeId, RootScopeNode | ChildScopeNode>();

  // Create root node with its direct children
  const root_child_ids = parent_child_map.get(root_id) || [];
  const root_node: RootScopeNode = {
    id: root_id,
    type: scope_type,
    name: null, // Root scopes typically don't have names
    location: node_location,
    parent_id: null,
    child_ids: root_child_ids,
  };
  nodes.set(root_id, root_node);

  // Create all child nodes with their proper parent and children
  for (const scope of all_scopes) {
    const parent_id = find_parent_scope(scope.node, scope_nodes, root_id);
    const child_ids = parent_child_map.get(scope.id) || [];

    const child_node: ChildScopeNode = {
      id: scope.id,
      type: scope.type as "class" | "function" | "method" | "constructor" | "block" | "parameter" | "local",
      name: scope.name,
      location: scope.location,
      parent_id: parent_id,
      child_ids: child_ids,
    };
    nodes.set(scope.id, child_node);
  }

  return {
    root_id,
    nodes,
    file_path,
  };
}

/**
 * Get the scope chain from the scope id to the root
 * @param scope_id - The scope id to get the chain for
 * @param tree - The scope tree to get the chain from
 * @returns The scope chain from the scope id to the root (innermost to outermost)
 */
export function get_scope_chain(scope_id: ScopeId, tree: ScopeTree): ScopeId[] {
  const chain: ScopeId[] = [];
  let current_id: ScopeId | null = scope_id;

  // Walk up the parent chain until we reach the root
  while (current_id) {
    const node = tree.nodes.get(current_id);
    if (!node) {
      // Scope not found - break to avoid infinite loop
      break;
    }

    chain.push(current_id);

    // Move to parent (will be null for root)
    current_id = node.parent_id;
  }

  return chain;
}

export function find_parent_class_scope(scope_id: ScopeId, tree: ScopeTree): ScopeNode | undefined {
  const node = tree.nodes.get(scope_id);
  if (!node) {
    return undefined;
  }
  const class_scope_node = node.parent_id ? tree.nodes.get(node.parent_id) : undefined;
  if (!class_scope_node) {
    return undefined;
  }
  if (class_scope_node.type !== "class") {
    throw new Error(`Scope '${scope_id}' has a non-class parent scope of type: '${class_scope_node.type}'`);
  }
  return class_scope_node;
}

export function find_scope_at_location(
  tree: ScopeTree,
  location: Location
): ScopeId | undefined {
  let most_specific_scope: ScopeId | undefined = undefined;
  let deepest_level = -1;

  // Check all scopes to find the most specific one containing the location
  for (const [scope_id, node] of tree.nodes) {
    if (location_contains(node.location, location)) {
      // Count the depth of this scope (number of ancestors)
      const chain = get_scope_chain(scope_id, tree);
      const depth = chain.length;

      // Keep the deepest (most specific) scope
      if (depth > deepest_level) {
        deepest_level = depth;
        most_specific_scope = scope_id;
      }
    }
  }

  return most_specific_scope;
}
