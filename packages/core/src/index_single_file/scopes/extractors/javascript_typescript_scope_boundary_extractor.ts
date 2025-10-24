import type { FilePath, Location } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  CommonScopeBoundaryExtractor,
  type ScopeBoundaries,
} from "../scope_boundary_base";
import { node_to_location } from "../../node_utils";

/**
 * Shared scope boundary extraction for JavaScript and TypeScript.
 * Both languages use braces for scoping and have similar AST structures.
 *
 * This base class contains the special logic that was previously in scope_processor.ts
 * for handling named function expressions and other TypeScript/JavaScript specifics.
 */
export abstract class JavaScriptTypeScriptScopeBoundaryExtractor
  extends CommonScopeBoundaryExtractor
{
  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // Handle when TreeSitter captures class_body directly instead of class_declaration
    if (node.type === "class_body") {
      return this.extract_class_body_boundaries(node, file_path);
    }

    // Node could be: class_declaration, class (TS), interface_declaration, enum_declaration

    const name_node = node.childForFieldName("name");
    const body_node =
      node.childForFieldName("body") ||
      node.childForFieldName("object"); // For interface_declaration

    if (!name_node && !body_node) {
      // For test mocks without name or body fields, use the entire node
      const location = node_to_location(node, file_path);
      return { symbol_location: location, scope_location: location };
    }

    if (!name_node) {
      throw new Error(`${node.type || "Node"} has no name field`);
    }

    if (!body_node) {
      throw new Error(`${node.type || "Node"} has no body field`);
    }

    // Symbol: just the name
    const symbol_location = node_to_location(name_node, file_path);

    // Scope: the body node (starts at "{", which is what we want)
    const scope_location = node_to_location(body_node, file_path);

    return { symbol_location, scope_location };
  }

  /**
   * Extract class body boundaries.
   * Handles when TreeSitter captures class_body directly instead of class_declaration.
   */
  protected extract_class_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // For class_body, we need to find the parent class declaration
    const parent = node.parent;
    if (!parent || !["class_declaration", "abstract_class_declaration", "class", "class_expression"].includes(parent.type)) {
      throw new Error("class_body node must have class declaration parent");
    }

    const name_node = parent.childForFieldName("name");
    if (!name_node) {
      // Handle anonymous classes - use the class body location for both symbol and scope
      const location = node_to_location(node, file_path);
      return { symbol_location: location, scope_location: location };
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(node, file_path),
    };
  }

  protected extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // Handle arrow functions specially (JavaScript-specific but also valid in TypeScript)
    if (node.type === "arrow_function") {
      return this.extract_arrow_function_boundaries(node, file_path);
    }

    // Handle both regular functions and named function expressions
    const name_node = node.childForFieldName("name");

    // Check if this is a named function expression
    const is_named_function_expr =
      node.type === "function_expression" && name_node !== null;

    if (is_named_function_expr) {
      // Named function expression: scope starts AFTER "function" keyword
      // The name itself is IN the function's scope (for self-reference)
      const function_keyword = node.child(0); // First child is "function" keyword

      if (!function_keyword) {
        throw new Error("Function expression has no function keyword");
      }

      const body_node = node.childForFieldName("body");
      if (!body_node) {
        // Handle interface method signatures which don't have bodies
        // For method signatures, the scope starts after the function keyword
        const params_node = node.childForFieldName("parameters");
        const symbol_location = node_to_location(name_node!, file_path);
        const scope_location = params_node
          ? node_to_location(params_node, file_path)
          : {
            file_path,
            start_line: function_keyword.endPosition.row + 1,
            start_column: function_keyword.endPosition.column + 2,
            end_line: function_keyword.endPosition.row + 1,
            end_column: function_keyword.endPosition.column + 2,
          };
        return { symbol_location, scope_location };
      }

      // Symbol: the function name (belongs to function's OWN scope)
      const symbol_location = node_to_location(name_node!, file_path);

      // Scope: starts after "function" keyword but before the name
      const scope_location: Location = {
        file_path,
        start_line: function_keyword.endPosition.row + 1,
        start_column: function_keyword.endPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      };

      return { symbol_location, scope_location };
    } else {
      // Regular function declaration or anonymous function expression
      const params_node = node.childForFieldName("parameters") || node.childForFieldName("parameter");
      const body_node = node.childForFieldName("body");

      if (!params_node && !body_node) {
        // For test mocks or functions without parameters/body, use the entire node
        const location = node_to_location(node, file_path);
        return { symbol_location: location, scope_location: location };
      }

      if (!body_node) {
        // Handle interface method signatures which don't have bodies
        // For method signatures, the scope is just the parameters
        const symbol_location = name_node
          ? node_to_location(name_node, file_path)
          : params_node
            ? node_to_location(params_node, file_path)
            : node_to_location(node, file_path);

        const scope_location = params_node
          ? node_to_location(params_node, file_path)
          : node_to_location(node, file_path);
        return { symbol_location, scope_location };
      }

      if (!params_node) {
        // Function without parameters but with body - scope starts at body
        const symbol_location = name_node
          ? node_to_location(name_node, file_path)
          : node_to_location(body_node, file_path);

        const scope_location = node_to_location(body_node, file_path);
        return { symbol_location, scope_location };
      }

      const symbol_location = name_node
        ? node_to_location(name_node, file_path)
        : node_to_location(params_node, file_path); // Anonymous: no name

      // Scope starts at parameters
      const scope_location: Location = {
        file_path,
        start_line: params_node.startPosition.row + 1,
        start_column: params_node.startPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      };

      return { symbol_location, scope_location };
    }
  }

  protected extract_constructor_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // Constructors are like methods - scope starts at parameters
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // Block scopes: entire node is the scope
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }

  /**
   * Extract boundaries for arrow functions.
   * Arrow functions don't have explicit names or parameter parentheses in some cases.
   */
  protected extract_arrow_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const params_node = node.childForFieldName("parameters") || node.childForFieldName("parameter");
    const body_node = node.childForFieldName("body");

    if (!body_node) {
      throw new Error("Arrow function missing body");
    }

    // For arrow functions, the symbol location is the parameter(s)
    const symbol_location = params_node
      ? node_to_location(params_node, file_path)
      : node_to_location(node, file_path);

    return {
      symbol_location,
      scope_location: {
        file_path,
        start_line: params_node ? params_node.startPosition.row + 1 : node.startPosition.row + 1,
        start_column: params_node ? params_node.startPosition.column + 1 : node.startPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      },
    };
  }
}