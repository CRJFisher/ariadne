/**
 * The provenance of an object-destructured binding: which identifier the
 * pattern unpacks and which property key the binding reads from it.
 *
 * Lives apart from the other symbol factories because it answers one question
 * with one strict AST walk; the strictness is the point. A nested pattern, a
 * parameter, a `for…of` head, a bare assignment, an array or rest pattern, and
 * any initializer that is not a bare identifier all return undefined, because
 * recording a source for those shapes would type the binding from a property
 * the source does not directly carry — a wrong edge, not a missing one.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * The binding an object destructuring unpacks and the property key it reads:
 * `const { storage } = options` names source "options" and key "storage";
 * `const { read: reader } = options` names source "options" and key "read" —
 * the written key, never the bound name.
 *
 * Both halves return together or not at all, so a consumer can never read a
 * source without its key. The pattern must be a variable declarator's own
 * object pattern and the declarator's initializer a bare identifier — the one
 * shape whose property carries a declared type a member lookup can reach.
 */
export function extract_destructured_binding(
  node: SyntaxNode
): { source: SymbolName; key: SymbolName } | undefined {
  let key: string;
  let pattern: SyntaxNode | null;

  if (node.type === "shorthand_property_identifier_pattern") {
    key = node.text;
    pattern = node.parent;
  } else if (node.parent?.type === "pair_pattern") {
    const pair = node.parent;
    if (pair.childForFieldName("value")?.id !== node.id) {
      return undefined;
    }
    const key_node = pair.childForFieldName("key");
    if (!key_node) {
      return undefined;
    }
    key = key_node.text;
    pattern = pair.parent;
  } else {
    return undefined;
  }

  if (pattern?.type !== "object_pattern") {
    return undefined;
  }

  const declarator = pattern.parent;
  if (declarator?.type !== "variable_declarator") {
    return undefined;
  }
  if (declarator.childForFieldName("name")?.id !== pattern.id) {
    return undefined;
  }

  const value = declarator.childForFieldName("value");
  if (value?.type !== "identifier") {
    return undefined;
  }

  return { source: value.text as SymbolName, key: key as SymbolName };
}
