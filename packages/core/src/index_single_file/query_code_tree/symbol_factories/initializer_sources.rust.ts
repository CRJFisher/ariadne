/**
 * What a Rust `let`/`const` initialiser names: the collection it is looked up
 * from and the callee chain of the call it is initialised from — and, for a
 * binding a `for` loop initialises, the container it takes an element of.
 * Resolution follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { IterationSource, SymbolName } from "@ariadnejs/types";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/HashMap lookup.
 *
 * Patterns detected:
 * 1. let handler = config.get("key");  -> returns "config"
 * 2. let handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (right side of assignment)
  let assignment = node;
  if (node.type === "identifier") {
    assignment = node.parent || node;
  }

  // Handle let_declaration: let x = ...
  if (assignment.type === "let_declaration" || assignment.type === "const_item") {
    const value_node = assignment.childForFieldName?.("value");
    if (!value_node) return undefined;

    // Case 1: Method call (config.get(...))
    if (value_node.type === "call_expression") {
      const function_node = value_node.childForFieldName?.("function");
      if (function_node?.type === "field_expression") {
        const value = function_node.childForFieldName?.("value");
        const field = function_node.childForFieldName?.("field");
        
        if (value?.type === "identifier" && field?.text === "get") {
          return value.text as SymbolName;
        }
      }
    }

    // Case 2: Index access (config["key"])
    if (value_node.type === "index_expression") {
      let operand = value_node.childForFieldName?.("operand");
      if (!operand) {
        // Fallback to first child if field name is not available
        operand = value_node.child(0) || null;
      }

      if (operand?.type === "identifier") {
        return operand.text as SymbolName;
      }
    }
  }

  return undefined;
}

/**
 * The callee chain of a `let`/`const` call initialiser, root first:
 * `["has_flatten"]` for `let has_flatten = has_flatten(fields)`, `["s", "get_info"]`
 * for `let i = s.get_info()`, `["self", "inner", "get"]` for `let g =
 * self.inner.get()`. A `::` path (`Foo::new()`) is left to the constructor and
 * path resolvers, and a callee that is not a field chain rooted at an identifier
 * or `self` has no chain.
 */
export function extract_initializer_call(
  node: SyntaxNode
): readonly SymbolName[] | undefined {
  const assignment = node.type === "identifier" ? (node.parent ?? node) : node;
  if (assignment.type !== "let_declaration" && assignment.type !== "const_item") {
    return undefined;
  }

  const value_node = assignment.childForFieldName("value");
  if (value_node?.type !== "call_expression") {
    return undefined;
  }

  let function_node = value_node.childForFieldName("function");
  // Turbofish `x::<T>()` wraps the callee in a generic_function; the chain is its
  // `function` child.
  if (function_node?.type === "generic_function") {
    function_node = function_node.childForFieldName("function");
  }
  return function_node ? field_chain(function_node) : undefined;
}

/**
 * The container a `for` loop's binding takes an element of: `l` in
 * `for l in &layers`, `layers.iter()` or `layers` holds what iterating `layers`
 * yields; `for v in m.values()` holds a value; `v` in `for (k, v) in &m` or
 * `m.iter()` holds the value half of an entry. `l` in
 * `for (i, l) in layers.iter().enumerate()` holds what iterating `layers.iter()`
 * yields, counted.
 */
export function extract_iteration_source(node: SyntaxNode): IterationSource | undefined {
  const parent = node.parent;
  if (parent?.type === "for_expression") {
    return parent.childForFieldName("pattern")?.id === node.id
      ? loop_iteration_source(parent, "whole")
      : undefined;
  }
  const loop = parent?.type === "tuple_pattern" ? parent.parent : null;
  if (
    !parent ||
    loop?.type !== "for_expression" ||
    loop.childForFieldName("pattern")?.id !== parent.id ||
    parent.namedChildren.findIndex((child) => child.id === node.id) !== 1
  ) {
    return undefined;
  }
  return loop_iteration_source(loop, "entry_value");
}

/** Calls that iterate their receiver exactly as iterating it directly does. */
const ITERATE_RECEIVER: ReadonlySet<string> = new Set(["iter", "iter_mut", "into_iter"]);

/** Calls that iterate their receiver's values. */
const ITERATE_VALUES: ReadonlySet<string> = new Set(["values", "values_mut"]);

function loop_iteration_source(
  loop: SyntaxNode,
  binds: "whole" | "entry_value"
): IterationSource | undefined {
  const iterable = loop.childForFieldName("value");
  return iterable ? iterable_source(iterable, binds) : undefined;
}

function iterable_source(
  node: SyntaxNode,
  binds: "whole" | "entry_value"
): IterationSource | undefined {
  const counted = binds === "entry_value" ? no_argument_call(node, "enumerate") : undefined;
  if (counted) {
    return iterable_source(counted, "whole");
  }

  let iterable: SyntaxNode | null = node;
  if (iterable.type === "reference_expression") {
    iterable = iterable.childForFieldName("value");
  }
  if (!iterable) {
    return undefined;
  }

  let over_values = false;
  const callee = iterable.type === "call_expression" ? iterable.childForFieldName("function") : null;
  if (callee?.type === "field_expression" && iterable.childForFieldName("arguments")?.namedChildCount === 0) {
    const called = callee.childForFieldName("field")?.text ?? "";
    if (!ITERATE_RECEIVER.has(called) && !ITERATE_VALUES.has(called)) {
      return undefined;
    }
    over_values = ITERATE_VALUES.has(called);
    iterable = callee.childForFieldName("value");
  }

  const container = iterable ? field_chain(iterable) : undefined;
  if (!container) {
    return undefined;
  }
  if (binds === "whole") {
    return { container, yields: over_values ? "value" : "item" };
  }
  return over_values ? undefined : { container, yields: "entry_value" };
}

/** The receiver of a no-argument `receiver.name()` call, or undefined when `node` is not one. */
function no_argument_call(node: SyntaxNode, name: string): SyntaxNode | undefined {
  const callee = node.type === "call_expression" ? node.childForFieldName("function") : null;
  if (
    callee?.type !== "field_expression" ||
    callee.childForFieldName("field")?.text !== name ||
    node.childForFieldName("arguments")?.namedChildCount !== 0
  ) {
    return undefined;
  }
  return callee.childForFieldName("value") ?? undefined;
}

function field_chain(node: SyntaxNode): SymbolName[] | undefined {
  if (node.type === "identifier" || node.type === "self") {
    return [node.text as SymbolName];
  }
  if (node.type !== "field_expression") {
    return undefined;
  }
  const value_node = node.childForFieldName("value");
  const field_node = node.childForFieldName("field");
  if (!value_node || field_node?.type !== "field_identifier") {
    return undefined;
  }
  const root = field_chain(value_node);
  return root ? [...root, field_node.text as SymbolName] : undefined;
}
