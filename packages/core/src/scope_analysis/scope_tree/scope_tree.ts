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

export function build_scope_tree(
  root: SyntaxNode,
  file_path: FilePath,
  language: Language
): ScopeTree {
  const node_location = node_to_location(root, file_path);

  // The root scope should cover the entire file, from line 1
  // to the end of the actual content
  const root_scope_location: Location = {
    file_path: file_path,
    line: 1,
    column: 1,
    end_line: node_location.end_line,
    end_column: node_location.end_column,
  };

  // Determine whether this file uses module or global scope
  const scope_type = determine_root_scope_type(language);
  const root_id =
    scope_type === "module"
      ? module_scope(root_scope_location)
      : global_scope(root_scope_location);

  // Load and execute the scope query for this language
  const query_string = load_scope_query(language);

  let all_scopes: Array<{
    node: SyntaxNode;
    id: ScopeId;
    name: ScopeName | null;
    type: ScopeType;
    location: Location;
  }> = [];
  let scope_nodes: Array<{ node: SyntaxNode; id: ScopeId }> = [];

  try {
    // Get the parser for this language to create the Query object
    const parser = get_language_parser(language);
    const query = new Query(parser.getLanguage(), query_string);

    // Execute the query on the AST
    const matches = query.matches(root);

    // Parse captures to extract scopes
    const parsed = parse_scope_captures(matches, file_path);
    all_scopes = parsed.all_scopes;
    scope_nodes = parsed.scope_nodes;
  } catch (e) {
    // Query parsing/execution failed, return minimal tree
    console.warn(`Failed to execute scope query for ${language}:`, e);
  }

  // Special handling for TypeScript abstract classes
  // Walk the tree and find abstract_class_declaration nodes
  if (language === "typescript") {
    const abstractClasses: SyntaxNode[] = [];

    function findAbstractClasses(node: SyntaxNode) {
      if (node.type === "abstract_class_declaration") {
        abstractClasses.push(node);
      }
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) findAbstractClasses(child);
      }
    }

    findAbstractClasses(root);

    for (const classNode of abstractClasses) {
      // Check if this class is already captured
      const location = node_to_location(classNode, file_path);
      const existingScope = all_scopes.find(s =>
        s.location.line === location.line &&
        s.location.column === location.column
      );

      if (!existingScope) {
        // Add this abstract class as a scope
        const scope_id = class_scope(location);
        const id_node = classNode.childForFieldName("name");
        const scope_name = id_node ? (id_node.text as ScopeName) : null;

        all_scopes.push({
          node: classNode,
          id: scope_id,
          type: "class",
          location: location,
          name: scope_name,
        });

        scope_nodes.push({ node: classNode, id: scope_id });
      }
    }
  }

  // Sort scope_nodes by start position to ensure consistent parent finding
  // Scopes that start earlier should be processed first
  scope_nodes.sort((a, b) => {
    const diff = a.node.startIndex - b.node.startIndex;
    if (diff !== 0) return diff;
    // If they start at the same position, larger scopes come first
    return b.node.endIndex - a.node.endIndex;
  });

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
    location: root_scope_location,
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
      type: scope.type as
        | "class"
        | "function"
        | "method"
        | "constructor"
        | "block"
        | "parameter"
        | "local",
      name: scope.name,
      location: scope.location,
      parent_id: parent_id,
      child_ids: child_ids,
    };
    nodes.set(scope.id, child_node);
  }

  // Pre-compute scope depths for efficient lookups
  const scope_depths = new Map<ScopeId, number>();
  scope_depths.set(root_id, 0);

  for (const scope of all_scopes) {
    const depth = compute_scope_depth(scope.id, nodes, root_id);
    scope_depths.set(scope.id, depth);
  }

  return {
    root_id,
    nodes,
    file_path,
    scope_depths,
  };
}

/**
 * Efficiently compute scope depth using the nodes map
 */
function compute_scope_depth(
  scope_id: ScopeId,
  nodes: Map<ScopeId, ScopeNode>,
  root_id: ScopeId
): number {
  if (scope_id === root_id) {
    return 0;
  }

  let depth = 0;
  let current_id: ScopeId | null = scope_id;

  while (current_id && current_id !== root_id) {
    const node = nodes.get(current_id);
    if (!node) break;

    depth++;
    current_id = node.parent_id;
  }

  return depth;
}

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
 * Parse scope captures from tree-sitter query matches
 */
function parse_scope_captures(
  matches: any[],
  file_path: FilePath
): {
  all_scopes: Array<{
    node: SyntaxNode;
    id: ScopeId;
    name: ScopeName | null;
    type: ScopeType;
    location: Location;
  }>;
  scope_nodes: Array<{ node: SyntaxNode; id: ScopeId }>;
} {
  const all_scopes: Array<{
    node: SyntaxNode;
    id: ScopeId;
    name: ScopeName | null;
    type: ScopeType;
    location: Location;
  }> = [];

  const scope_nodes: Array<{ node: SyntaxNode; id: ScopeId }> = [];

  // Process all captures
  for (const match of matches) {
    for (const capture of match.captures) {
      const captured_node = capture.node;
      const capture_name = capture.name;

      if (capture_name === "local.scope") {
        // Special handling for abstract classes - check parent node
        let actualNode = captured_node;
        if (captured_node.parent &&
            captured_node.parent.type === "abstract_class_declaration" &&
            captured_node.type !== "abstract_class_declaration") {
          // If this is a child of abstract_class_declaration, use the parent
          actualNode = captured_node.parent;
        }

        // Determine scope type based on the node type
        let scope_type_from_capture: ScopeType;

        switch (actualNode.type) {
          // JavaScript/TypeScript function nodes
          case "function_declaration":
          case "function_expression":
          case "arrow_function":
          case "generator_function_declaration":
          case "generator_function":
          // Python function nodes
          case "function_definition":
          case "lambda":
            scope_type_from_capture = "function";
            break;
          // JavaScript/TypeScript method nodes
          case "method_definition":
            scope_type_from_capture = "method";
            break;
          // JavaScript/TypeScript class nodes
          case "class_declaration":
          case "abstract_class_declaration":
          case "class_expression":
          case "class":  // Anonymous classes in TypeScript
          // Python class nodes
          case "class_definition":
            scope_type_from_capture = "class";
            break;
          // Block scope nodes
          case "statement_block":
          case "for_statement":
          case "for_in_statement":
          case "switch_case":
          case "catch_clause":
          // Python block nodes
          case "block":
          case "with_statement":
          // Python comprehensions
          case "list_comprehension":
          case "dictionary_comprehension":
          case "set_comprehension":
          case "generator_expression":
            scope_type_from_capture = "block";
            break;
          default:
            scope_type_from_capture = "local";
        }

        // Create scope ID based on location and type
        const scope_location = node_to_location(actualNode, file_path);
        let scope_id: ScopeId;
        let scope_name: ScopeName | null = null;

        switch (scope_type_from_capture) {
          case "function":
            scope_id = function_scope(scope_location);
            // Extract function name based on node type
            if (
              actualNode.type === "function_declaration" ||
              actualNode.type === "generator_function_declaration" ||
              actualNode.type === "generator_function"
            ) {
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            } else if (actualNode.type === "function_expression") {
              // Named function expressions have a name field
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            } else if (actualNode.type === "function_definition") {
              // Python function definition
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            }
            // Arrow functions and lambdas are anonymous
            break;
          case "method":
            scope_id = function_scope(scope_location); // Methods use function scope type
            // Extract method name
            if (actualNode.type === "method_definition") {
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            }
            break;
          case "class":
            scope_id = class_scope(scope_location);
            // Extract class name
            if (
              actualNode.type === "class_declaration" ||
              actualNode.type === "abstract_class_declaration" ||
              actualNode.type === "class_expression"
            ) {
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            } else if (actualNode.type === "class_definition") {
              // Python class definition
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            } else if (actualNode.type === "class") {
              // TypeScript anonymous class
              const id_node = actualNode.childForFieldName("name");
              scope_name = id_node ? (id_node.text as ScopeName) : null;
            }
            break;
          case "block":
            scope_id = block_scope(scope_location);
            break;
          default:
            scope_id = local_scope(scope_location);
        }

        all_scopes.push({
          node: actualNode,
          id: scope_id,
          type: scope_type_from_capture,
          location: scope_location,
          name: scope_name,
        });

        scope_nodes.push({ node: actualNode, id: scope_id });
      }
    }
  }

  return { all_scopes, scope_nodes };
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

export function find_parent_class_scope(
  scope_id: ScopeId,
  tree: ScopeTree
): ScopeNode | undefined {
  const node = tree.nodes.get(scope_id);
  if (!node) {
    return undefined;
  }
  const class_scope_node = node.parent_id
    ? tree.nodes.get(node.parent_id)
    : undefined;
  if (!class_scope_node) {
    return undefined;
  }
  if (class_scope_node.type !== "class") {
    return undefined;
  }
  return class_scope_node;
}

/**
 * Find the most specific scope containing the given location
 * Optimized with pre-computed depths - O(n) but much faster constant factor
 */
export function find_scope_at_location(
  tree: ScopeTree,
  location: Location
): ScopeId | undefined {
  let most_specific_scope: ScopeId | undefined = undefined;
  let deepest_level = -1;

  // Check all scopes to find the most specific one containing the location
  for (const [scope_id, node] of tree.nodes) {
    if (location_contains(node.location, location)) {
      // Use pre-computed depth instead of expensive chain calculation
      const depth = tree.scope_depths.get(scope_id) ?? 0;

      // Keep the deepest (most specific) scope
      if (depth > deepest_level) {
        deepest_level = depth;
        most_specific_scope = scope_id;
      }
    }
  }

  return most_specific_scope;
}
