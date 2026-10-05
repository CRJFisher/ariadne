/**
 * What a Rust `let`/`const` value names: the collection it is looked up from,
 * the one name it reads, and the callee chain of the call it is initialised
 * from — and, for a binding a `for` loop initialises, the container it takes an
 * element of. A `let` declared without a value names what every later
 * assignment to it agrees on, and each value is read through what does not
 * change it: an `unsafe` block, and the standard-library calls that return
 * their own argument (`let me = Pin::into_inner(self)` reads `self`).
 * Resolution follows each to type or dispatch the binding.
 */

import type { SyntaxNode } from "tree-sitter";
import type { IterationSource, SymbolName } from "@ariadnejs/types";
import { agreed } from "./agreed_fact";
import { written_values } from "./binding_writes.rust";

/**
 * Extract the name of the collection variable this definition was looked up from.
 * Used for collection dispatch - when a variable is assigned from a Map/HashMap lookup.
 *
 * Patterns detected:
 * 1. let handler = config.get("key");  -> returns "config"
 * 2. let handler = config["key"];      -> returns "config"
 */
export function extract_collection_source(node: SyntaxNode): SymbolName | undefined {
  return agreed(let_values(node), collection_read);
}

function collection_read(value_node: SyntaxNode): SymbolName | undefined {
  // Case 1: Method call (config.get(...))
  if (value_node.type === "call_expression") {
    const function_node = value_node.childForFieldName("function");
    if (function_node?.type === "field_expression") {
      const value = function_node.childForFieldName("value");
      const field = function_node.childForFieldName("field");
      if (value?.type === "identifier" && field?.text === "get") {
        return value.text as SymbolName;
      }
    }
  }

  // Case 2: Index access (config["key"])
  if (value_node.type === "index_expression") {
    const operand = value_node.childForFieldName("operand") ?? value_node.child(0);
    if (operand?.type === "identifier") {
      return operand.text as SymbolName;
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
  return agreed(let_values(node), called_chain);
}

function called_chain(value_node: SyntaxNode): readonly SymbolName[] | undefined {
  if (value_node.type !== "call_expression") {
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
 * The one name a `let`/`const` initialiser reads as a whole: `let this = self`,
 * `let parser = base`. Anything else — a call, a reference, a path — reads no
 * one name.
 */
export function extract_read_source(node: SyntaxNode): { name_source?: SymbolName } {
  return agreed(let_values(node), whole_read) ?? {};
}

function whole_read(value_node: SyntaxNode): { name_source?: SymbolName } {
  return value_node.type === "identifier" || value_node.type === "self"
    ? { name_source: value_node.text as SymbolName }
    : {};
}

/**
 * Every value written into the `let` or `const` `node` declares or names: a
 * `const`'s value, a `let`'s initialiser, or the later assignments to a `let`
 * declared without one (`binding_writes.rust.ts`).
 */
function let_values(node: SyntaxNode): readonly SyntaxNode[] {
  const declaration = node.type === "identifier" ? (node.parent ?? node) : node;
  if (declaration.type === "const_item") {
    const value = declaration.childForFieldName("value");
    return value ? [held_expression(value)] : [];
  }
  return written_values(declaration).map(held_expression);
}

/**
 * Standard-library calls that hand back the value they are given, or a
 * wrapper that derefs to it: `ManuallyDrop::new(self)` and the `Pin`
 * unwrappings. `std` is in no corpus, so nothing else can say what they
 * return, and without this `let me = Pin::into_inner(self)` holds nothing.
 */
const RETURNS_ITS_ARGUMENT: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["ManuallyDrop", new Set(["new"])],
  ["Pin", new Set(["into_inner", "into_inner_unchecked", "get_mut", "get_unchecked_mut"])],
]);

const STANDARD_PATH_SEGMENTS: ReadonlySet<string> = new Set(["std", "core", "mem", "pin"]);

/** `Pin`'s methods that return what a `self: Pin<&mut Self>` receiver points at. */
const PIN_UNWRAPPING_METHODS: ReadonlySet<string> = new Set(["get_mut", "get_unchecked_mut"]);

/**
 * The expression whose value `value` holds, seen through what does not change
 * it: an `unsafe { … }` block ending in one expression, and the
 * standard-library calls that return their own argument.
 */
function held_expression(value: SyntaxNode): SyntaxNode {
  if (value.type === "unsafe_block") {
    const block = value.namedChildren.find((child) => child.type === "block");
    const statements = block?.namedChildren.filter((child) => !child.type.endsWith("comment")) ?? [];
    const last = statements[statements.length - 1];
    return statements.length === 1 && last.type !== "expression_statement" ? held_expression(last) : value;
  }
  if (value.type !== "call_expression") {
    return value;
  }
  const callee = value.childForFieldName("function");
  const call_arguments = value.childForFieldName("arguments")?.namedChildren ?? [];
  if (callee?.type === "scoped_identifier" && call_arguments.length === 1 && returns_its_argument(callee.text)) {
    return held_expression(call_arguments[0]);
  }
  const receiver = callee?.type === "field_expression" ? callee.childForFieldName("value") : null;
  const method = callee?.childForFieldName("field")?.text;
  return receiver?.type === "self" &&
    method !== undefined &&
    PIN_UNWRAPPING_METHODS.has(method) &&
    call_arguments.length === 0 &&
    receiver_is_pinned(value)
    ? receiver
    : value;
}

/** Whether a `::` path names one of the `RETURNS_ITS_ARGUMENT` calls, bare or through a standard path. */
function returns_its_argument(path: string): boolean {
  const segments = path.split("::").map((segment) => segment.trim());
  const [type_name, function_name] = segments.slice(-2);
  return (
    segments.length >= 2 &&
    segments.slice(0, -2).every((segment) => STANDARD_PATH_SEGMENTS.has(segment)) &&
    RETURNS_ITS_ARGUMENT.get(type_name)?.has(function_name) === true
  );
}

/**
 * Whether the function enclosing `node` declares its receiver `self: Pin<…>`.
 * Method lookup on a pinned receiver reaches `Pin`'s own `get_mut` before
 * anything the pointee declares; on a `&mut self` receiver the same call is the
 * pointee's, and says nothing about what it returns.
 */
function receiver_is_pinned(node: SyntaxNode): boolean {
  let function_item: SyntaxNode | null = node.parent;
  while (function_item && function_item.type !== "function_item" && function_item.type !== "closure_expression") {
    function_item = function_item.parent;
  }
  const receiver = function_item?.type === "function_item" ? function_item.childForFieldName("parameters")?.namedChildren[0] : undefined;
  const declared = receiver?.type === "parameter" && receiver.childForFieldName("pattern")?.type === "self" ? receiver.childForFieldName("type") : null;
  const head = declared?.type === "generic_type" ? declared.childForFieldName("type")?.text : undefined;
  return head !== undefined && returns_its_argument(`${head}::get_mut`);
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
