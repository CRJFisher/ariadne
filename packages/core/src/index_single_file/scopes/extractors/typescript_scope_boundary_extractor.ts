import type { FilePath, ScopeType } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { type ScopeBoundaries } from "../boundary_base";
import { node_to_location } from "../../node_to_location";
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";

/**
 * Scope boundary extraction for TypeScript. Extends the shared JS/TS extractor
 * with the TypeScript-only scope constructs: interfaces, enums, and namespaces.
 */
export class TypeScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath,
  ): ScopeBoundaries {
    switch (scope_type) {
    case "class":
      // Interfaces and enums are captured under the `class` scope type.
      return this.extract_typescript_class_like_boundaries(node, file_path);
    case "module":
      // Namespaces are captured under the `module` scope type.
      return this.extract_namespace_boundaries(node, file_path);
    default:
      return super.extract_boundaries(node, scope_type, file_path);
    }
  }

  private extract_typescript_class_like_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    switch (node.type) {
    case "interface_declaration":
      return this.extract_interface_boundaries(node, file_path);
    case "interface_body":
      return this.extract_interface_body_boundaries(node, file_path);
    case "enum_declaration":
      return this.extract_enum_boundaries(node, file_path);
    case "enum_body":
      return this.extract_enum_body_boundaries(node, file_path);
    case "class_declaration":
    case "class_body":
      return super.extract_class_boundaries(node, file_path);
    default:
      throw new Error(`Unsupported TypeScript class-like node type: ${node.type}`);
    }
  }

  private extract_interface_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Interface declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Interface declaration has no body field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  private extract_enum_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Enum declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Enum declaration has no body field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * tree-sitter can capture interface_body directly. The interface name lives on
   * the parent declaration, so the symbol location resolves through node.parent.
   */
  private extract_interface_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const parent = node.parent;
    if (!parent || parent.type !== "interface_declaration") {
      throw new Error("interface_body node must have interface_declaration parent");
    }

    const name_node = parent.childForFieldName("name");
    if (!name_node) {
      throw new Error("Interface declaration has no name field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(node, file_path),
    };
  }

  /**
   * tree-sitter can capture enum_body directly. The enum name lives on the
   * parent declaration, so the symbol location resolves through node.parent.
   */
  private extract_enum_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    const parent = node.parent;
    if (!parent || parent.type !== "enum_declaration") {
      throw new Error("enum_body node must have enum_declaration parent");
    }

    const name_node = parent.childForFieldName("name");
    if (!name_node) {
      throw new Error("Enum declaration has no name field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(node, file_path),
    };
  }

  private extract_namespace_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // The root program node has no name field; returning its full location lets
    // process_scopes drop it via the file_location comparison.
    if (node.type === "program") {
      const location = node_to_location(node, file_path);
      return { symbol_location: location, scope_location: location };
    }

    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Namespace declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Namespace declaration has no body field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }
}
