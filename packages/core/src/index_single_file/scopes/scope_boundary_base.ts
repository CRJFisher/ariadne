/**
 * Base classes and interfaces for scope boundary extraction.
 * This file contains the shared interfaces and base classes without any dependencies
 * on the specific language extractors to avoid circular imports.
 */

import type { FilePath, Location, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { node_to_location } from "../node_utils";

/**
 * Extracted boundary information for a scope-creating construct.
 *
 * The symbol_location belongs to the parent scope (where the name is declared).
 * The scope_location defines the new child scope being created.
 */
export interface ScopeBoundaries {
  // Where the symbol name is declared (e.g., class name, function name)
  // This location belongs to the PARENT scope
  symbol_location: Location;

  // Where the scope that symbol creates begins and ends
  // This location defines the NEW CHILD scope
  scope_location: Location;
}

/**
 * Language-specific extractor for scope boundaries.
 *
 * Different tree-sitter grammars report node positions differently.
 * This interface provides a semantic transformation from raw tree-sitter
 * positions to our scope boundary model.
 */
export interface ScopeBoundaryExtractor {
  /**
   * Extract semantic scope boundaries from a tree-sitter node.
   *
   * @param node - Tree-sitter node captured as a scope
   * @param scope_type - Type of scope being created
   * @param file_path - File path for location construction
   * @returns Symbol location (for parent scope) and scope location (for new scope)
   */
  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries;
}

/**
 * Common scope boundary extraction logic.
 *
 * This class provides default implementations that work for TypeScript,
 * JavaScript, Rust, and most other languages. Language-specific extractors
 * only need to override methods for special cases.
 *
 * Common patterns:
 * - Class scope = `body` field node (works for TS, JS, Rust)
 * - Function scope = parameters to end (works for most)
 * - Block scope = entire node (works for all)
 *
 * Special cases requiring overrides:
 * - Python: class body needs colon finding (body field is wrong position)
 * - TS/JS: named function expressions need special handling
 */
export class CommonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries {
    switch (scope_type) {
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

  /**
   * Default class boundary extraction.
   *
   * Uses the `body` field directly - works for most languages where
   * tree-sitter reports the body position correctly.
   *
   * Works for: TypeScript, JavaScript, Rust
   * Override for: Python (body starts at first child, not at delimiter)
   */
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

  /**
   * Default function boundary extraction.
   *
   * Scope starts at parameters node (excludes function name from scope).
   * This works for most languages.
   *
   * Works for: Python, Rust, most function declarations
   * Override for: JS/TS named function expressions (special case)
   */
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

  /**
   * Default constructor boundary extraction.
   * Same as function boundaries for most languages.
   */
  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    return this.extract_function_boundaries(node, file_path);
  }

  /**
   * Default block boundary extraction.
   * The entire node is the scope (no separate name).
   * This works for ALL languages.
   */
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

// Re-export node utilities for convenience
export { node_to_location, position_to_location } from "../node_utils";