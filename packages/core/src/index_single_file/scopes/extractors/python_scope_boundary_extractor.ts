import type { FilePath, Location, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  ScopeBoundaryExtractor,
  ScopeBoundaries,
} from "../scopes.boundary_base";
import { node_to_location } from "../../node_utils";

export class PythonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

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

  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // For class scopes, we might get either class_definition or block nodes
    // depending on how tree-sitter captures are configured
    if (node.type === "block") {
      // If we get a block node, find the parent class_definition
      let class_node = node.parent;
      while (class_node && class_node.type !== "class_definition") {
        class_node = class_node.parent;
      }
      if (!class_node) {
        throw new Error("Block node is not inside a class_definition");
      }
      return this.extract_class_boundaries_from_definition(class_node, file_path);
    } else if (node.type === "class_definition") {
      return this.extract_class_boundaries_from_definition(node, file_path);
    } else {
      throw new Error(
        `Expected class_definition or block node for class scope, got ${node.type}`
      );
    }
  }

  private extract_class_boundaries_from_definition(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Node should be class_definition
    if (node.type !== "class_definition") {
      throw new Error(
        `Expected class_definition node, got ${node.type}`
      );
    }

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Class definition has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Class definition has no body field");
    }

    // Symbol location: just the name (belongs to parent scope)
    const symbol_location = node_to_location(name_node, file_path);

    // Scope location: THE TRICKY PART
    // We need to find the ":" token that starts the class body
    const colon_position = this.find_colon_after_name(node, name_node);

    // Scope should start right after the colon, but include the entire body
    const scope_location: Location = {
      file_path,
      start_line: colon_position.row + 1,  // Use colon position, not body position
      start_column: colon_position.column + 2,  // After the colon + 1 space
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };


    return { symbol_location, scope_location };
  }

  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Handle different types of function-like nodes
    if (node.type === "function_definition") {
      return this.extract_regular_function_boundaries(node, file_path);
    } else if (node.type === "lambda") {
      return this.extract_lambda_boundaries(node, file_path);
    } else if (node.type === "decorated_definition") {
      return this.extract_decorated_function_boundaries(node, file_path);
    } else {
      throw new Error(
        `Expected function_definition, lambda, or decorated_definition node, got ${node.type}`
      );
    }
  }

  private extract_regular_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Node should be function_definition
    if (node.type !== "function_definition") {
      throw new Error(
        `Expected function_definition node, got ${node.type}`
      );
    }

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Function definition has no name field");
    }

    const params_node = node.childForFieldName("parameters");
    if (!params_node) {
      throw new Error("Function definition has no parameters field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Function definition has no body field");
    }

    // Symbol location: just the name
    const symbol_location = node_to_location(name_node, file_path);

    // For Python functions, scope starts at parameters
    // This is different from classes where scope starts after the colon
    const scope_location: Location = {
      file_path,
      start_line: params_node.startPosition.row + 1,
      start_column: params_node.startPosition.column + 1,
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };


    return { symbol_location, scope_location };
  }

  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Python doesn't have special constructor syntax - __init__ is a regular method
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // For block scopes (if, for, while, etc.), the entire node is the scope
    // There's no separate "name" for blocks
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location, // Blocks don't have names, use same location
      scope_location: location,
    };
  }

  /**
   * Find the ":" token that starts a class body.
   *
   * In Python AST, class_definition has children like:
   * [class_keyword, name, superclasses?, ":", body]
   *
   * We need to find the ":" token position.
   */
  private find_colon_after_name(
    class_node: Parser.SyntaxNode,
    name_node: Parser.SyntaxNode
  ): Parser.Point {
    // Strategy: Search for ":" in class_node's children after the name
    let found_name = false;

    for (let i = 0; i < class_node.childCount; i++) {
      const child = class_node.child(i);
      if (!child) continue;

      // Track when we've passed the name node
      if (child.id === name_node.id) {
        found_name = true;
        continue;
      }

      // After name, look for ":" token
      if (found_name && child.text === ":") {
        return child.startPosition;
      }

      // Also check if this is a ":" node by type
      if (found_name && child.type === ":") {
        return child.startPosition;
      }
    }

    // Fallback: If we can't find the colon (shouldn't happen for valid Python),
    // use the position right after the name
    console.warn(
      `Could not find colon in class definition at line ${name_node.startPosition.row + 1}`
    );
    return {
      row: name_node.endPosition.row,
      column: name_node.endPosition.column + 1,
    };
  }

  /**
   * Extract decorated function boundaries.
   * Decorated definitions contain the actual function definition inside.
   */
  private extract_decorated_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // For decorated_definition, we need to find the actual function_definition inside
    const definition_node = node.childForFieldName("definition");
    if (!definition_node) {
      throw new Error("Decorated definition has no definition field");
    }

    // Recursively extract boundaries from the inner function definition
    return this.extract_function_boundaries(definition_node, file_path);
  }

  /**
   * Extract lambda boundaries.
   * Lambda expressions are anonymous functions with different structure.
   */
  private extract_lambda_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // For lambda expressions, there's no separate name - they're anonymous
    // The entire lambda expression is both the symbol and scope
    const location = node_to_location(node, file_path);

    // For lambdas, symbol location and scope location are the same
    // since they don't have a separate name declaration
    return {
      symbol_location: location,
      scope_location: location,
    };
  }
}