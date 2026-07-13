// Kept free of imports from the language extractors so those can extend this
// base without a circular dependency.

import type { FilePath, Location, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { node_to_location } from "../node_to_location";
import type { CaptureNode } from "../capture_types";

export interface ScopeBoundaries {
  // The name declaration belongs to the parent scope, not the scope it opens.
  symbol_location: Location;
  // The child scope the construct creates.
  scope_location: Location;
}

/**
 * Scope type priority for deterministic sorting.
 * Lower number = processed first (parent types before child types).
 * When two captures have identical locations, this ensures parent scopes
 * are created before child scopes.
 */
const SCOPE_TYPE_PRIORITY: Record<string, number> = {
  module: 0,
  namespace: 0,
  class: 1,
  interface: 1,
  enum: 1,
  function: 2,
  method: 3,
  constructor: 3,
  closure: 4,
  block: 5,
};

/**
 * Get priority for a capture entity for sorting purposes.
 */
export function get_capture_priority(entity: string): number {
  return SCOPE_TYPE_PRIORITY[entity] ?? 10;
}

/**
 * Compare two locations for sorting
 */
export function compare_locations(a: Location, b: Location): number {
  if (a.start_line !== b.start_line) return a.start_line - b.start_line;
  if (a.start_column !== b.start_column) return a.start_column - b.start_column;
  if (a.end_line !== b.end_line) return a.end_line - b.end_line;
  return a.end_column - b.end_column;
}

/**
 * Check if a location contains another location
 * For well-formed nested scopes, checking the start position is usually sufficient,
 * but we verify both start and end for correctness.
 */
export function location_contains(
  container: Location,
  contained: Location
): boolean {
  // Check if contained START is within container bounds
  if (
    contained.start_line < container.start_line ||
    contained.start_line > container.end_line
  ) {
    return false;
  }

  // If on the start line, check column is at or after container start
  if (
    contained.start_line === container.start_line &&
    contained.start_column < container.start_column
  ) {
    return false;
  }

  // Check if contained END is within container bounds
  if (
    contained.end_line < container.start_line ||
    contained.end_line > container.end_line
  ) {
    return false;
  }

  // If on the end line, check column is at or before container end
  if (
    contained.end_line === container.end_line &&
    contained.end_column > container.end_column
  ) {
    return false;
  }

  return true;
}

/**
 * Calculate area of a location (for finding smallest containing scope)
 * Uses a position-based calculation for accurate ordering across multi-line spans
 */
export function calculate_area(location: Location): number {
  // Convert start and end to single position numbers
  // Each line is worth 10000 units to ensure column positions don't overflow
  const start_pos = location.start_line * 10000 + location.start_column;
  const end_pos = location.end_line * 10000 + location.end_column;
  return end_pos - start_pos;
}

// tree-sitter grammars report node positions differently per language; an
// extractor maps those raw positions onto the semantic scope-boundary model,
// and orders scope captures so parents are created before their children.
export interface ScopeBoundaryExtractor {
  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries;

  sort_captures(captures: readonly CaptureNode[]): CaptureNode[];
}

// Default extraction covering the shape shared by TypeScript, JavaScript, and
// Rust. Language extractors override only the methods whose grammar diverges.
export class CommonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

  // Location order plus the scope-type priority tiebreak yields a
  // deterministic parent-before-child creation order for brace-scoped grammars.
  sort_captures(captures: readonly CaptureNode[]): CaptureNode[] {
    return [...captures].sort(
      (a, b) =>
        compare_locations(a.location, b.location) ||
        get_capture_priority(a.entity) - get_capture_priority(b.entity)
    );
  }

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries {
    switch (scope_type) {
      case "module":
        return this.extract_module_boundaries(node, file_path);
      case "class":
        return this.extract_class_boundaries(node, file_path);
      case "function":
      case "method":
        return this.extract_function_boundaries(node, file_path);
      case "constructor":
        return this.extract_constructor_boundaries(node, file_path);
      case "block":
        return this.extract_block_boundaries(node, file_path);
      default:
        throw new Error(`Unsupported scope type: ${scope_type}`);
    }
  }

  protected extract_module_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    const body_node = node.childForFieldName("body");

    const symbol_location = name_node
      ? node_to_location(name_node, file_path)
      : node_to_location(node, file_path);

    const scope_location = body_node
      ? node_to_location(body_node, file_path)
      : node_to_location(node, file_path);

    return { symbol_location, scope_location };
  }

  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error(`${node.type} has no name field`);
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error(`${node.type} has no body field`);
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  // Scope opens at the parameter list so the function's own name stays in the
  // parent scope rather than the scope it creates.
  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    const params_node = node.childForFieldName("parameters");
    const body_node = node.childForFieldName("body");

    if (!params_node || !body_node) {
      throw new Error(`${node.type} missing parameters or body`);
    }

    return {
      symbol_location: name_node
        ? node_to_location(name_node, file_path)
        : node_to_location(params_node, file_path),
      scope_location: {
        file_path,
        start_line: params_node.startPosition.row + 1,
        start_column: params_node.startPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      },
    };
  }

  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    return this.extract_function_boundaries(node, file_path);
  }

  // A block has no name, so the whole node serves as both symbol and scope.
  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }
}