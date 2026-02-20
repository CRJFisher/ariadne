import type { FilePath, ScopeType } from "@ariadnejs/types";
import Parser from "tree-sitter";
import { CommonScopeBoundaryExtractor, type ScopeBoundaries } from "../boundary_base";
import { node_to_location } from "../../node_utils";

/**
 * Rust-specific scope boundary extractor.
 *
 * Rust has specific constructs that need special handling:
 * - Struct definitions
 * - Enum definitions
 * - Impl blocks
 * - Trait definitions
 * - Module definitions
 *
 * For most cases, the common extractor works fine since Rust
 * tree-sitter grammar follows standard patterns.
 */
export class RustScopeBoundaryExtractor extends CommonScopeBoundaryExtractor {

  extract_boundaries(
    node: Parser.SyntaxNode,
    scope_type: ScopeType,
    file_path: FilePath
  ): ScopeBoundaries {
    switch (scope_type) {
      case "class":
        // Rust class-like constructs: struct, enum, trait, impl
        return this.extract_rust_class_like_boundaries(node, file_path);
      case "module":
        return this.extract_module_boundaries(node, file_path);
      default:
        // Use common logic for function, method, constructor, block
        return super.extract_boundaries(node, scope_type, file_path);
    }
  }

  private extract_rust_class_like_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Handle different Rust class-like constructs based on node type
    switch (node.type) {
      case "struct_item":
        return this.extract_struct_boundaries(node, file_path);
      case "enum_item":
        return this.extract_enum_boundaries(node, file_path);
      case "trait_item":
        return this.extract_trait_boundaries(node, file_path);
      case "impl_item":
        return this.extract_impl_boundaries(node, file_path);
      case "field_declaration_list":
        return this.extract_field_list_boundaries(node, file_path);
      case "enum_variant_list":
        return this.extract_enum_variant_list_boundaries(node, file_path);
      case "declaration_list":
        return this.extract_declaration_list_boundaries(node, file_path);
      default:
        // Fall back to common logic for other types
        return super.extract_class_boundaries(node, file_path);
    }
  }

  /**
   * Extract struct boundaries.
   * Similar to class but for struct declarations.
   */
  private extract_struct_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Struct declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      // Some structs don't have bodies (unit structs)
      const location = node_to_location(name_node, file_path);
      return {
        symbol_location: location,
        scope_location: location,
      };
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * Extract enum boundaries.
   */
  private extract_enum_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
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
   * Extract trait boundaries.
   */
  private extract_trait_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Trait declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      throw new Error("Trait declaration has no body field");
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * Extract impl boundaries.
   */
  private extract_impl_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    // Impl blocks don't have names, use the type being implemented
    const type_node = node.childForFieldName("type");
    const body_node = node.childForFieldName("body");

    if (!body_node) {
      throw new Error("Impl block has no body field");
    }

    const symbol_location = type_node
      ? node_to_location(type_node, file_path)
      : node_to_location(node, file_path);

    return {
      symbol_location,
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * Extract module boundaries.
   */
  private extract_module_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const name_node = node.childForFieldName("name");
    if (!name_node) {
      throw new Error("Module declaration has no name field");
    }

    const body_node = node.childForFieldName("body");
    if (!body_node) {
      // External modules don't have bodies
      const location = node_to_location(name_node, file_path);
      return {
        symbol_location: location,
        scope_location: location,
      };
    }

    return {
      symbol_location: node_to_location(name_node, file_path),
      scope_location: node_to_location(body_node, file_path),
    };
  }

  /**
   * Extract boundaries for field declaration lists (struct/enum body parts).
   */
  private extract_field_list_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }

  /**
   * Extract boundaries for enum variant lists.
   */
  private extract_enum_variant_list_boundaries(
    node: Parser.SyntaxNode,
    file_path: FilePath
  ): ScopeBoundaries {
    const location = node_to_location(node, file_path);
    return {
      symbol_location: location,
      scope_location: location,
    };
  }

  /**
   * Extract boundaries for declaration lists (trait/impl body parts).
   */
  private extract_declaration_list_boundaries(
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