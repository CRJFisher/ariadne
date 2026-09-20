/**
 * The name chain a JavaScript or TypeScript callable hands back: the one chain
 * every value-bearing `return` in its own body returns, and for a concise arrow
 * body the expression itself.
 *
 * `getFormClass() { return this.formClass; }` returns `["this", "formClass"]`,
 * so a binding the call initialises holds whatever that field holds — the route
 * a class takes out of the accessor that fetches it and into the caller that
 * constructs it.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";
import { name_chain } from "./initializer_sources.javascript";

/**
 * The chain the returns of the callable at `node` agree on, or undefined where they do not:
 * a return of anything but a name chain, two returns naming different chains, a
 * body that returns no value. One chain or none — a body returning two classes
 * describes neither.
 */
export function extract_returned_name_chain(
  node: SyntaxNode
): readonly SymbolName[] | undefined {
  const body = enclosing_callable(node)?.childForFieldName("body");
  if (!body) {
    return undefined;
  }
  if (body.type !== "statement_block") {
    return name_chain(body);
  }

  let agreed: readonly SymbolName[] | undefined;
  for (const returned of own_returned_values(body)) {
    const chain = name_chain(returned);
    if (!chain) {
      return undefined;
    }
    if (agreed && !same_chain(agreed, chain)) {
      return undefined;
    }
    agreed = chain;
  }
  return agreed;
}

/**
 * The callable `node` declares, whether the handler hands in the declaration
 * itself or the name identifier inside it. The walk stops at the first callable
 * so a method never reads the returns of the function enclosing it.
 */
function enclosing_callable(node: SyntaxNode): SyntaxNode | null {
  for (let n: SyntaxNode | null = node; n; n = n.parent) {
    if (CALLABLES.has(n.type)) {
      return n;
    }
    if (n.type === "program" || n.type === "statement_block") {
      return null;
    }
  }
  return null;
}

const CALLABLES: ReadonlySet<string> = new Set([
  "function_declaration",
  "function_expression",
  "generator_function_declaration",
  "generator_function",
  "arrow_function",
  "method_definition",
]);

/**
 * Every value a `return` in this body hands back, skipping the bodies of
 * callables and classes nested inside it — their returns belong to them.
 */
function own_returned_values(body: SyntaxNode): SyntaxNode[] {
  const values: SyntaxNode[] = [];
  const pending: SyntaxNode[] = [body];
  while (pending.length > 0) {
    const node = pending.pop() as SyntaxNode;
    if (node.type === "return_statement") {
      const value = node.namedChildren[0];
      if (value) {
        values.push(value);
      }
      continue;
    }
    if (NESTED_BODIES.has(node.type)) {
      continue;
    }
    pending.push(...node.namedChildren);
  }
  return values;
}

/** Constructs that own their own returns, so the walk stops at them. */
const NESTED_BODIES: ReadonlySet<string> = new Set([
  "function_declaration",
  "function_expression",
  "generator_function_declaration",
  "generator_function",
  "arrow_function",
  "method_definition",
  "class_declaration",
  "class",
]);

function same_chain(left: readonly SymbolName[], right: readonly SymbolName[]): boolean {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}
