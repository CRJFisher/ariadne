/**
 * What a Python binding's initialiser names: the collection it is looked up
 * from, the name or member it reads, the callee chain of the call it is
 * initialised from or of the call whose result it calls, and — for a binding a
 * `for` loop or tuple unpacking initialises — the container it takes an element
 * of. A parameter's default names what its initialiser would. Resolution
 * follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { IterationSource, MemberSource, SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/Dict lookup.
 *
 * Patterns detected:
 * 1. handler = config.get("key")  -> returns "config"
 * 2. handler = config["key"]      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier" || node.type === "attribute") {
    assignment = node.parent || node;
  }

  if (assignment.type !== "assignment") {
    // Try to find parent assignment
    let current = node.parent;
    while (current) {
      if (current.type === "assignment") {
        assignment = current;
        break;
      }
      current = current.parent;
    }
  }

  if (assignment.type !== "assignment") {
    return undefined;
  }

  const value_node = assignment.childForFieldName?.("right");
  if (!value_node) {
    return undefined;
  }

  // Case 1: Method call (config.get(...))
  if (value_node.type === "call") {
    const function_node = value_node.childForFieldName?.("function");
    if (function_node?.type === "attribute") {
      const object_node = function_node.childForFieldName?.("object");
      const attribute_node = function_node.childForFieldName?.("attribute");

      if (object_node?.type === "identifier" && attribute_node?.text === "get") {
        return object_node.text as SymbolName;
      }
    }
  }

  // Case 2: Subscript access (config[...])
  if (value_node.type === "subscript") {
    const value = value_node.childForFieldName?.("value");
    if (value?.type === "identifier") {
      return value.text as SymbolName;
    }
  }

  return undefined;
}

/**
 * The callee chain of a plain `name = call(...)` initialiser, root first:
 * `["connect"]` for `c = connect()`, `["s", "get_info"]` for `i = s.get_info()`,
 * `["self", "factory"]` for `p = self.factory()`. A callee that is not an
 * attribute chain rooted at an identifier (`make()(…)`, `table[k]()`) has no
 * chain, and neither does a target that is not the bare name the assignment
 * binds (`a, b = f()`).
 */
export function extract_initializer_call(node: SyntaxNode): readonly SymbolName[] | undefined {
  const value_node = bound_value(node);
  if (value_node?.type !== "call") {
    return undefined;
  }
  const function_node = value_node.childForFieldName("function");
  return function_node ? attribute_chain(function_node) : undefined;
}

/**
 * The callee chain of the call whose result a plain `name = call(...)(...)`
 * initialiser calls in turn: `["make"]` for `p = make()(io)`. A callee of the
 * inner call that is not an attribute chain rooted at an identifier has no
 * chain, and neither does a call of anything but a call.
 */
export function extract_initializer_result_call(node: SyntaxNode): readonly SymbolName[] | undefined {
  const value_node = bound_value(node);
  const callee_node = value_node?.type === "call" ? value_node.childForFieldName("function") : null;
  if (callee_node?.type !== "call") {
    return undefined;
  }
  const inner_callee = callee_node.childForFieldName("function");
  return inner_callee ? attribute_chain(inner_callee) : undefined;
}

/**
 * What an assignment's value or a parameter's default reads as a whole: the one
 * name of `mapper_cls = Mapper` and `def trace(Info=TraceInfo)`, or the holder
 * and member of `orig = BaseTask.__call__`. A call, a literal, a subscript or a
 * longer chain reads neither.
 */
export function extract_read_source(node: SyntaxNode): {
  name_source?: SymbolName;
  member_source?: MemberSource;
} {
  const value_node = bound_value(node) ?? default_value(node);
  if (value_node?.type === "identifier") {
    return { name_source: value_node.text as SymbolName };
  }
  if (value_node?.type !== "attribute") {
    return {};
  }
  const holder_node = value_node.childForFieldName("object");
  const member_node = value_node.childForFieldName("attribute");
  if (holder_node?.type !== "identifier" || !member_node) {
    return {};
  }
  return { member_source: { holder: holder_node.text as SymbolName, member: member_node.text as SymbolName } };
}

/**
 * The container a loop or unpacking binding takes an element of: `x` in
 * `for x in xs` and each name of `a, b = xs` hold what iterating `xs` yields;
 * `for v in d.values()` holds a value; `v` in `for k, v in d.items()` holds the
 * value half of an entry. Iterating a dict itself yields its keys, so a pair
 * unpacked straight off one holds no entry. `x` in `for i, x in enumerate(xs)`
 * holds what iterating `xs` yields, counted.
 */
export function extract_iteration_source(node: SyntaxNode): IterationSource | undefined {
  const parent = node.parent;
  if (parent && LOOPS.has(parent.type)) {
    return parent.childForFieldName("left")?.id === node.id
      ? loop_iteration_source(parent, "whole")
      : undefined;
  }
  if (parent?.type !== "pattern_list" && parent?.type !== "tuple_pattern") {
    return undefined;
  }

  const holder = parent.parent;
  if (!holder || holder.childForFieldName("left")?.id !== parent.id) {
    return undefined;
  }
  if (LOOPS.has(holder.type)) {
    return parent.namedChildren.findIndex((child) => child.id === node.id) === 1
      ? loop_iteration_source(holder, "entry_value")
      : undefined;
  }
  if (holder.type === "assignment") {
    const value_node = holder.childForFieldName("right");
    const container = value_node ? attribute_chain(value_node) : undefined;
    return container ? { container, yields: "item" } : undefined;
  }
  return undefined;
}

/** A `for` statement and a comprehension's `for` clause both bind `left` to each item of `right`. */
const LOOPS: ReadonlySet<string> = new Set(["for_statement", "for_in_clause"]);

function loop_iteration_source(
  loop: SyntaxNode,
  binds: "whole" | "entry_value"
): IterationSource | undefined {
  const iterable = loop.childForFieldName("right");
  return iterable ? iterable_source(iterable, binds) : undefined;
}

function iterable_source(
  iterable: SyntaxNode,
  binds: "whole" | "entry_value"
): IterationSource | undefined {
  const counted = binds === "entry_value" ? enumerated(iterable) : undefined;
  if (counted) {
    return iterable_source(counted, "whole");
  }

  const method = iteration_method(iterable);
  const container = attribute_chain(method ? method.receiver : iterable);
  if (!container) {
    return undefined;
  }
  const called = method?.name;
  if (binds === "whole") {
    if (called === undefined) return { container, yields: "item" };
    return called === "values" ? { container, yields: "value" } : undefined;
  }
  return called === "items" ? { container, yields: "entry_value" } : undefined;
}

/** A no-argument `values()` or `items()` call on a receiver, which iterates that receiver's values or entries. */
function iteration_method(
  node: SyntaxNode
): { readonly receiver: SyntaxNode; readonly name: "values" | "items" } | undefined {
  if (node.type !== "call" || node.childForFieldName("arguments")?.namedChildCount !== 0) {
    return undefined;
  }
  const callee = node.childForFieldName("function");
  const receiver = callee?.type === "attribute" ? callee.childForFieldName("object") : null;
  const name = callee?.childForFieldName("attribute")?.text;
  return receiver && (name === "values" || name === "items") ? { receiver, name } : undefined;
}

/**
 * The iterable an `enumerate(xs)` or `enumerate(xs, start)` call counts, whose
 * pairs hold an index and what iterating `xs` yields.
 */
function enumerated(node: SyntaxNode): SyntaxNode | undefined {
  const counted =
    node.type === "call" && node.childForFieldName("function")?.text === "enumerate"
      ? node.childForFieldName("arguments")?.namedChildren[0]
      : undefined;
  return counted && counted.type !== "keyword_argument" && counted.type !== "list_splat"
    ? counted
    : undefined;
}

/** The default of the parameter `node` names (`Info` in `Info=TraceInfo`). */
function default_value(node: SyntaxNode): SyntaxNode | null {
  const parameter = node.parent;
  if (
    (parameter?.type !== "default_parameter" && parameter?.type !== "typed_default_parameter") ||
    parameter.childForFieldName("name")?.id !== node.id
  ) {
    return null;
  }
  return parameter.childForFieldName("value");
}

/** The right-hand side of the assignment whose left side is exactly `node`. */
function bound_value(node: SyntaxNode): SyntaxNode | null {
  const assignment = node.parent;
  if (assignment?.type !== "assignment" || assignment.childForFieldName("left")?.id !== node.id) {
    return null;
  }
  return assignment.childForFieldName("right");
}

function attribute_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier") {
    return [node.text as SymbolName];
  }
  if (node.type !== "attribute") {
    return undefined;
  }
  const object_node = node.childForFieldName("object");
  const attribute_node = node.childForFieldName("attribute");
  if (!object_node || !attribute_node) {
    return undefined;
  }
  const root = attribute_chain(object_node);
  return root ? [...root, attribute_node.text as SymbolName] : undefined;
}
