import type { FilePath, ScopeType, SymbolName } from "@ariadnejs/types";
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
 * block scope boundaries match the common brace-oriented base exactly and are
 * inherited; only the self type of an `impl` block is read here.
 */
export class RustScopeBoundaryExtractor extends CommonScopeBoundaryExtractor {
  // An `impl` block is the one block scope that binds `self`, to the type it
  // implements and never to the trait. Struct, enum and trait bodies are
  // class scopes the base already names from the item around them.
  override extract_self_type_name(
    node: Parser.SyntaxNode,
    scope_type: ScopeType
  ): SymbolName | null {
    const parent = node.parent;
    if (
      scope_type === "block" &&
      node.type === "declaration_list" &&
      parent?.type === "impl_item"
    ) {
      return implemented_type_name(parent);
    }
    return super.extract_self_type_name(node, scope_type);
  }

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

/**
 * The bare name of the type an `impl` block implements: a `type_identifier`,
 * or the identifier under a `generic_type` (`impl S<T>` and `impl Tr for S<T>`
 * both name `S`).
 *
 * Two shapes deliberately name nothing. A reference, tuple, pointer or scoped
 * path wraps its type, and recording the wrapped name would claim `self` IS
 * the owned type, which the member lookup cannot yet tell apart from an
 * inherent impl. A blanket impl's `type` is one of the block's own type
 * parameters (`impl<T> Tr for T`), which stands for every implementor rather
 * than for a definition — and, spelled as Rust convention allows
 * (`impl<Handler> Service for Handler`), would otherwise collide with an
 * unrelated type of that name.
 */
function implemented_type_name(impl_node: Parser.SyntaxNode): SymbolName | null {
  const type_node = impl_node.childForFieldName("type");
  if (!type_node) return null;

  const base =
    type_node.type === "generic_type"
      ? type_node.childForFieldName("type")
      : type_node;
  if (base?.type !== "type_identifier") return null;

  const name = base.text as SymbolName;
  return declares_type_parameter(impl_node, name) ? null : name;
}

function declares_type_parameter(
  impl_node: Parser.SyntaxNode,
  name: SymbolName
): boolean {
  const parameters = impl_node.childForFieldName("type_parameters");
  if (!parameters) return false;
  return parameters.namedChildren.some(
    (parameter) =>
      parameter.type === "type_parameter" &&
      parameter.childForFieldName("name")?.text === name
  );
}
