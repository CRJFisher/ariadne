import type { FilePath, Location } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  CommonScopeBoundaryExtractor,
  type ScopeBoundaries,
} from "../boundary_base";
import { node_to_location } from "../../node_to_location";

/**
 * Scope boundary extraction shared by JavaScript and TypeScript, used directly
 * for JavaScript. Both languages brace-scope with near-identical AST structure;
 * TypeScript-only constructs (interface, enum, namespace) are added by the
 * TypeScript subclass.
 */
export class JavaScriptTypeScriptScopeBoundaryExtractor
  extends CommonScopeBoundaryExtractor
{
  protected extract_class_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    if (node.type === "class_body") {
      return this.extract_class_body_boundaries(node, file_path);
    }

    const name_node = node.childForFieldName("name");
    // interface_declaration exposes its members under `object`, not `body`.
    const body_node =
      node.childForFieldName("body") ||
      node.childForFieldName("object");

    if (!name_node && !body_node) {
      const location = node_to_location(node, file_path);
      return { symbol_location: location, scope_location: location };
    }

    if (!name_node) {
      throw new Error(`${node.type || "Node"} has no name field`);
    }

    if (!body_node) {
      throw new Error(`${node.type || "Node"} has no body field`);
    }

    const symbol_location = node_to_location(name_node, file_path);
    const scope_location = node_to_location(body_node, file_path);

    return { symbol_location, scope_location };
  }

  /**
   * Extract boundaries when TreeSitter captures a class_body directly rather
   * than its enclosing class declaration.
   */
  protected extract_class_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const parent = node.parent;
    if (!parent || !["class_declaration", "abstract_class_declaration", "class", "class_expression"].includes(parent.type)) {
      throw new Error("class_body node must have class declaration parent");
    }

    const name_node = parent.childForFieldName("name");
    if (!name_node) {
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
    if (node.type === "arrow_function") {
      return this.extract_arrow_function_boundaries(node, file_path);
    }

    const name_node = node.childForFieldName("name");

    // A named function expression scopes its own name for self-reference, so
    // the name belongs inside the function scope rather than the parent scope.
    const is_named_function_expr =
      node.type === "function_expression" && name_node !== null;

    if (is_named_function_expr) {
      const function_keyword = node.child(0);

      if (!function_keyword) {
        throw new Error("Function expression has no function keyword");
      }

      const body_node = node.childForFieldName("body");
      if (!body_node) {
        const params_node = node.childForFieldName("parameters");
        const symbol_location = node_to_location(name_node, file_path);
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

      const symbol_location = node_to_location(name_node, file_path);

      // Scope opens right after the `function` keyword so the name sits inside it.
      const scope_location: Location = {
        file_path,
        start_line: function_keyword.endPosition.row + 1,
        start_column: function_keyword.endPosition.column + 1,
        end_line: body_node.endPosition.row + 1,
        end_column: body_node.endPosition.column,
      };

      return { symbol_location, scope_location };
    } else {
      const params_node = node.childForFieldName("parameters") || node.childForFieldName("parameter");
      const body_node = node.childForFieldName("body");

      if (!params_node && !body_node) {
        const location = node_to_location(node, file_path);
        return { symbol_location: location, scope_location: location };
      }

      if (!body_node) {
        // Body-less signatures (interface/method signatures) scope to their parameters.
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
        const symbol_location = name_node
          ? node_to_location(name_node, file_path)
          : node_to_location(body_node, file_path);

        const scope_location = node_to_location(body_node, file_path);
        return { symbol_location, scope_location };
      }

      const symbol_location = name_node
        ? node_to_location(name_node, file_path)
        : node_to_location(params_node, file_path);

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
    return this.extract_function_boundaries(node, file_path);
  }

  protected extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }

  /**
   * Arrow functions have no name; a single unparenthesized parameter appears
   * under `parameter` rather than `parameters`, and the scope falls back to the
   * whole node when there is no parameter list at all.
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