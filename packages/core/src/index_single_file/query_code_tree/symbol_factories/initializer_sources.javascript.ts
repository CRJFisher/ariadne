/**
 * What a JavaScript/TypeScript variable's initialiser names: the collection it
 * is looked up from, the member it reads, the callee chain of the call it is
 * initialised from, and — for a binding a `for…of` loop or an array pattern
 * initialises — the container it takes an element of. Resolution follows each
 * to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { IterationSource, SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/Array/Object lookup.
 *
 * Patterns detected:
 * 1. const handler = config.get("key");  -> returns "config"
 * 2. const handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  const value_node = declarator_value(node);
  if (!value_node) {
    return undefined;
  }

  // Case 1: Method call (config.get(...))
  if (value_node.type === "call_expression") {
    const function_node = value_node.childForFieldName("function");
    if (function_node?.type === "member_expression") {
      const object_node = function_node.childForFieldName("object");
      if (object_node?.type === "identifier") {
        return object_node.text as SymbolName;
      }
    }
  }

  // Case 2: Member access (config[...])
  if (value_node.type === "member_expression" || value_node.type === "subscript_expression") {
    const object_node = value_node.childForFieldName("object");
    if (object_node?.type === "identifier") {
      return object_node.text as SymbolName;
    }
  }

  return undefined;
}

/**
 * The callee chain of a declarator's call or construction initialiser, root
 * first: `["get_scope_boundary_extractor"]` for
 * `const e = get_scope_boundary_extractor()`, `["s", "getInfo"]` for
 * `const i = s.getInfo()`, `["this", "#tm", "get"]` for
 * `const t = this.#tm.get()`, `["cls"]` for `const p = new cls()`. A callee
 * that is not a name chain rooted at an identifier or `this` (`make()()`,
 * `a[k]()`, `super.f()`) has no chain.
 */
export function extract_initializer_call(node: SyntaxNode): readonly SymbolName[] | undefined {
  const value_node = declarator_value(node);
  const callee_node =
    value_node?.type === "call_expression"
      ? value_node.childForFieldName("function")
      : value_node?.type === "new_expression"
        ? value_node.childForFieldName("constructor")
        : null;
  return callee_node ? name_chain(callee_node) : undefined;
}

/**
 * The holder and member a plain member-read initialiser names: `var alias = Ns.A`
 * → `{ holder: "Ns", member: "A" }`. A call, a subscript or a chain deeper than one
 * hop names no single member of a bare holder.
 */
export function extract_member_source(
  node: SyntaxNode
): { holder: SymbolName; member: SymbolName } | undefined {
  const value_node = declarator_value(node);
  if (value_node?.type !== "member_expression") {
    return undefined;
  }
  const holder_node = value_node.childForFieldName("object");
  const member_node = value_node.childForFieldName("property");
  if (holder_node?.type !== "identifier" || member_node?.type !== "property_identifier") {
    return undefined;
  }
  return { holder: holder_node.text as SymbolName, member: member_node.text as SymbolName };
}

/**
 * The container a loop or array-destructuring binding takes an element of:
 * `for (const x of xs)` and each name of `const [a, b] = xs` hold what iterating
 * `xs` yields; `for (const v of m.values())` holds a value; `v` in
 * `for (const [k, v] of m)` or `m.entries()` holds the value half of an entry.
 * A `for…in` loop binds keys, and a key is never an element.
 */
export function extract_iteration_source(node: SyntaxNode): IterationSource | undefined {
  const parent = node.parent;
  if (parent?.type === "for_in_statement") {
    return parent.childForFieldName("left")?.id === node.id
      ? loop_iteration_source(parent, "whole")
      : undefined;
  }
  if (parent?.type !== "array_pattern") {
    return undefined;
  }

  const holder = parent.parent;
  if (holder?.type === "for_in_statement" && holder.childForFieldName("left")?.id === parent.id) {
    return pattern_position(parent, node) === 1
      ? loop_iteration_source(holder, "entry_value")
      : undefined;
  }
  if (holder?.type === "variable_declarator" && holder.childForFieldName("name")?.id === parent.id) {
    const value_node = holder.childForFieldName("value");
    const container = value_node ? name_chain(value_node) : undefined;
    return container ? { container, yields: "item" } : undefined;
  }
  return undefined;
}

/**
 * What a `for…of` loop's binding holds of its iterable: the whole of each
 * iteration, or the value half of an entry pair it destructures.
 */
function loop_iteration_source(
  loop: SyntaxNode,
  binds: "whole" | "entry_value"
): IterationSource | undefined {
  const iterable = loop.childForFieldName("right");
  if (loop.childForFieldName("operator")?.text !== "of" || !iterable) {
    return undefined;
  }

  const method = iteration_method(iterable);
  const container = name_chain(method ? method.receiver : iterable);
  if (!container) {
    return undefined;
  }
  const called = method?.name;
  if (binds === "whole") {
    if (called === undefined) return { container, yields: "item" };
    return called === "values" ? { container, yields: "value" } : undefined;
  }
  return called === undefined || called === "entries"
    ? { container, yields: "entry_value" }
    : undefined;
}

/** A no-argument `values()` or `entries()` call on a receiver, which iterates that receiver's values or entries. */
function iteration_method(
  node: SyntaxNode
): { readonly receiver: SyntaxNode; readonly name: "values" | "entries" } | undefined {
  if (node.type !== "call_expression" || node.childForFieldName("arguments")?.namedChildCount !== 0) {
    return undefined;
  }
  const callee = node.childForFieldName("function");
  const receiver = callee?.type === "member_expression" ? callee.childForFieldName("object") : null;
  const name = callee?.childForFieldName("property")?.text;
  return receiver && (name === "values" || name === "entries") ? { receiver, name } : undefined;
}

/** The index `element` takes in an array pattern, counting elided holes (`[, v]` puts `v` at 1). */
function pattern_position(pattern: SyntaxNode, element: SyntaxNode): number {
  let position = 0;
  for (const child of pattern.children) {
    if (child.id === element.id) return position;
    if (child.type === ",") position++;
  }
  return -1;
}

function declarator_value(node: SyntaxNode): SyntaxNode | null {
  const declarator =
    node.type === "identifier" || node.type === "property_identifier"
      ? (node.parent ?? node)
      : node;
  return declarator.childForFieldName("value") ?? declarator.childForFieldName("init");
}

/**
 * A callee's names alone, root first. A receiver's `build_property_chain` also
 * carries call arguments and subscripts, which a name the type registry looks up
 * cannot hold, so a chain with either has no names here.
 */
function name_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier" || node.type === "this") {
    return [node.text as SymbolName];
  }
  if (node.type !== "member_expression") {
    return undefined;
  }
  const object_node = node.childForFieldName("object");
  const property_node = node.childForFieldName("property");
  if (
    !object_node ||
    (property_node?.type !== "property_identifier" &&
      property_node?.type !== "private_property_identifier")
  ) {
    return undefined;
  }
  const root = name_chain(object_node);
  return root ? [...root, property_node.text as SymbolName] : undefined;
}
