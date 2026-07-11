import type { FilePath } from "@ariadnejs/types";
import type Parser from "tree-sitter";
import { CommonScopeBoundaryExtractor, type ScopeBoundaries } from "../boundary_base";
import { node_to_location } from "../../node_to_location";

/**
 * Scope boundary extraction for Rust.
 *
 * Rust's scope query captures class-family scopes — struct, enum, and trait
 * bodies — on the body node (field_declaration_list, enum_variant_list,
 * declaration_list) rather than the named item. That body node carries no name
 * field, so it is both the symbol and the scope. Module, function, closure, and
 * block scopes match the common brace-oriented base exactly and are inherited.
 */
export class RustScopeBoundaryExtractor extends CommonScopeBoundaryExtractor {
  protected override extract_class_boundaries(
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
