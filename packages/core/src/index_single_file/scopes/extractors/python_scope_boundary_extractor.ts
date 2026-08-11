import type { FilePath, Location, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import {
  ScopeBoundaryExtractor,
  ScopeBoundaries,
  calculate_area,
  compare_locations,
  get_capture_priority,
  location_contains,
} from "../boundary_base";
import { node_to_location } from "../../node_to_location";
import type { CaptureNode } from "../../capture_types";

// Python opens scopes with a colon and indentation rather than braces, so the
// body-start column has to be derived from the ":" token position. That divergence
// is why this extractor implements ScopeBoundaryExtractor directly instead of
// reusing CommonScopeBoundaryExtractor's brace-oriented boundary logic.
export class PythonScopeBoundaryExtractor implements ScopeBoundaryExtractor {

  // A Python class scope opens after the ":" and can share its start position
  // with the scope of a method defined on its first line, which a plain
  // location sort mis-orders. Containment decides parent-before-child
  // directly, then area (larger first) and scope-type priority break ties,
  // falling back to the common location order.
  sort_captures(captures: readonly CaptureNode[]): CaptureNode[] {
    return [...captures].sort((a, b) => {
      const a_contains_b = location_contains(a.location, b.location);
      const b_contains_a = location_contains(b.location, a.location);

      if (a_contains_b && !b_contains_a) {
        return -1;
      }
      if (b_contains_a && !a_contains_b) {
        return 1;
      }

      const area_a = calculate_area(a.location);
      const area_b = calculate_area(b.location);
      if (area_a !== area_b) {
        return area_b - area_a;
      }

      const priority_diff =
        get_capture_priority(a.entity) - get_capture_priority(b.entity);
      if (priority_diff !== 0) {
        return priority_diff;
      }

      return compare_locations(a.location, b.location);
    });
  }

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries {
    switch (scope_type) {
      case "module": {
        // The module scope spans the whole file; the scope processor discards it
        // by comparing against the file location, so name and scope coincide here.
        const location = node_to_location(node, file_path);
        return { symbol_location: location, scope_location: location };
      }
      case "class":
        return this.extract_class_boundaries(node, file_path);
      case "function":
      case "method":
        return this.extract_function_boundaries(node, file_path);
      case "constructor":
        return this.extract_function_boundaries(node, file_path);
      case "block":
        return this.extract_block_boundaries(node, file_path);
      default:
        throw new Error(`Unsupported scope type: ${scope_type}`);
    }
  }

  // The class scope capture is the body `block`; walk up to the `class_definition`
  // to recover the name declaration and the colon that opens the body.
  private extract_class_boundaries(
    block_node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    if (block_node.type !== "block") {
      throw new Error(
        `Expected block node for class scope, got ${block_node.type}`
      );
    }

    let class_node = block_node.parent;
    while (class_node && class_node.type !== "class_definition") {
      class_node = class_node.parent;
    }
    if (!class_node) {
      throw new Error("Block node is not inside a class_definition");
    }

    const name_node = class_node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Class definition has no name field");
    }

    const colon_position = this.find_colon_after_name(class_node, name_node);

    const scope_location: Location = {
      file_path,
      start_line: colon_position.row + 1,
      start_column: colon_position.column + 2,
      end_line: block_node.endPosition.row + 1,
      end_column: block_node.endPosition.column,
    };

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location,
    };
  }

  private extract_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    if (node.type === "function_definition") {
      return this.extract_regular_function_boundaries(node, file_path);
    } else if (node.type === "lambda") {
      return this.extract_lambda_boundaries(node, file_path);
    } else {
      throw new Error(
        `Expected function_definition or lambda node, got ${node.type}`
      );
    }
  }

  private extract_regular_function_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
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

    // Scope opens at the parameter list so the function's own name stays in the
    // parent scope rather than the scope it creates.
    const scope_location: Location = {
      file_path,
      start_line: params_node.startPosition.row + 1,
      start_column: params_node.startPosition.column + 1,
      end_line: body_node.endPosition.row + 1,
      end_column: body_node.endPosition.column,
    };

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location,
    };
  }

  private extract_block_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // A block (if/for/while/...) has no name declaration, so the whole node
    // serves as both symbol and scope.
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }

  // Scans the class_definition's children after the name for the ":" token that
  // opens the body, since Python's body start is delimited by the colon, not a brace.
  private find_colon_after_name(
    class_node: Parser.SyntaxNode,
    name_node: Parser.SyntaxNode
  ): Parser.Point {
    let found_name = false;

    for (let i = 0; i < class_node.childCount; i++) {
      const child = class_node.child(i);
      if (!child) continue;

      if (child.id === name_node.id) {
        found_name = true;
        continue;
      }

      if (found_name && child.text === ":") {
        return child.startPosition;
      }
    }

    // Malformed source with no colon: fall back to just past the name so the
    // scope still has a defined start.
    console.warn(
      `Could not find colon in class definition at line ${name_node.startPosition.row + 1}`
    );
    return {
      row: name_node.endPosition.row,
      column: name_node.endPosition.column + 1,
    };
  }

  // Lambdas are anonymous, so there is no separate name declaration to split out;
  // the whole expression is both symbol and scope.
  private extract_lambda_boundaries(
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
