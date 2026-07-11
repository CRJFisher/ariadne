// Kept free of imports from the language extractors so those can extend this
// base without a circular dependency.

import type { FilePath, Location, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { node_to_location } from "../node_to_location";

export interface ScopeBoundaries {
  // The name declaration belongs to the parent scope, not the scope it opens.
  symbol_location: Location;
  // The child scope the construct creates.
  scope_location: Location;
}

// tree-sitter grammars report node positions differently per language; an
// extractor maps those raw positions onto the semantic scope-boundary model.
export interface ScopeBoundaryExtractor {
  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries;
}

// Default extraction covering the shape shared by TypeScript, JavaScript, and
// Rust. Language extractors override only the methods whose grammar diverges.
export class CommonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

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