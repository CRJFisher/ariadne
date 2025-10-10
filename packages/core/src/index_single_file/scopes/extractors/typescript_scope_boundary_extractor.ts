import type { FilePath, ScopeType } from "@ariadnejs/types";
import Parser from "tree-sitter";
import { type ScopeBoundaries, node_to_location } from "../scope_boundary_base";
import { JavaScriptTypeScriptScopeBoundaryExtractor } from "./javascript_typescript_scope_boundary_extractor";

/**
 * TypeScript-specific scope boundary extractor.
 * Inherits most logic from shared JS/TS base, with TS-specific adjustments.
 *
 * TypeScript follows similar patterns to JavaScript with some specific cases:
 * - Interface declarations
 * - Type aliases
 * - Namespaces
 * - Enum declarations
 */
export class TypeScriptScopeBoundaryExtractor extends JavaScriptTypeScriptScopeBoundaryExtractor {

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath,
  ): ScopeBoundaries {
    switch (scope_type) {
    case "class":
      // TypeScript class-like constructs: interface, enum
      return this.extract_typescript_class_like_boundaries(node, file_path);
    case "module":
      // TypeScript module-like constructs: namespace
      return this.extract_namespace_boundaries(node, file_path);
    default:
      // Use common logic for function, method, constructor, block
      return super.extract_boundaries(node, scope_type, file_path);
    }
  }

  private extract_typescript_class_like_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // Handle different TypeScript class-like constructs based on node type
    if (!node.type) {
      // For test mocks without type, use the base class handling
      return super.extract_class_boundaries(node, file_path);
    }

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
      // Regular class - use default logic from base class
      return super.extract_class_boundaries(node, file_path);
    case "class_body":
      // Handled by base class
      return super.extract_class_boundaries(node, file_path);
    default:
      throw new Error(`Unsupported TypeScript class-like node type: ${node.type}`);
    }
  }

  /**
   * Extract interface boundaries.
   * Similar to class but with interface-specific handling.
   */
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

  /**
   * Extract enum boundaries.
   * Similar to class but for enum declarations.
   */
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
   * Extract interface body boundaries.
   * Handles when TreeSitter captures interface_body directly instead of interface_declaration.
   */
  private extract_interface_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // For interface_body, we need to find the parent interface_declaration
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
   * Extract enum body boundaries.
   * Handles when TreeSitter captures enum_body directly instead of enum_declaration.
   */
  private extract_enum_body_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
    // For enum_body, we need to find the parent enum_declaration
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

  /**
   * Extract namespace boundaries.
   * Similar to class but for namespace declarations.
   */
  private extract_namespace_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath,
  ): ScopeBoundaries {
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