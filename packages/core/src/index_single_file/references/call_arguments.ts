/**
 * The positional arguments one call site writes.
 *
 * A class passed here is the only evidence that types the parameter it binds,
 * which is how a class reaches a construction site inside the factory it was
 * handed to (`build(MyForm)` against `def build(cls, **kw): return cls(**kw)`).
 *
 * Every supported grammar spells a call the same way — an `arguments` field on
 * the call node, holding the arguments in source order — so this reads the same
 * shape for all of them rather than dispatching on language.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";

/**
 * The arguments of the call `node` is the callee of, naming each bare
 * identifier and holding `null` for anything else — a literal, an expression, a
 * keyword argument — so a later argument keeps its own index. The list ends at
 * a spread, which stands for an unknown number of positions, and skips a
 * comment, which stands for none.
 *
 * Undefined where `node` is not a callee, and empty for a call taking no
 * arguments: a parameter list nothing binds and one with no parameters at all
 * are the same answer.
 */
export function extract_call_arguments(
  node: SyntaxNode
): readonly (SymbolName | null)[] | undefined {
  const arguments_node = enclosing_call(node)?.childForFieldName("arguments");
  if (!arguments_node) {
    return undefined;
  }
  const written: (SymbolName | null)[] = [];
  for (const argument of arguments_node.namedChildren) {
    // A comment is a named child of the argument list in every grammar here and
    // binds no parameter, so counting it would move every argument after it off
    // the position it binds.
    if (argument.type === "comment") {
      continue;
    }
    // A spread hands over an unknown number of arguments, so nothing after it
    // has a position this can name.
    if (SPREADS.has(argument.type)) {
      break;
    }
    written.push(argument.type === "identifier" ? (argument.text as SymbolName) : null);
  }
  return written;
}

/** Arguments that stand for an unknown number of positions. */
const SPREADS: ReadonlySet<string> = new Set(["spread_element", "list_splat"]);

/**
 * The call `node` is the callee of, or part of the callee of (`a.b`,
 * `worker::create`). The nearest enclosing call is the only candidate, and it
 * answers only while `node` sits ahead of its argument list — a name inside the
 * arguments is another call's callee, or no callee at all.
 */
function enclosing_call(node: SyntaxNode): SyntaxNode | null {
  for (let n: SyntaxNode | null = node; n; n = n.parent) {
    if (!CALLS.has(n.type)) {
      continue;
    }
    const arguments_node = n.childForFieldName("arguments");
    return arguments_node && node.startIndex < arguments_node.startIndex ? n : null;
  }
  return null;
}

const CALLS: ReadonlySet<string> = new Set(["call", "call_expression"]);
