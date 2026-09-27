/**
 * The one fact every value written into a binding states.
 *
 * A binding written more than once holds whichever write ran last, which the
 * syntax tree cannot say. A fact every write agrees on holds whichever it was;
 * a fact they disagree on holds nothing — the one-value-or-none rule
 * `returned_name_chain` applies to a body's returns — so a missing edge is
 * never replaced by a wrong one.
 */

import type { SyntaxNode } from "tree-sitter";

/** What `fact` reads from every one of `values` when they all read the same, else undefined. */
export function agreed<T>(values: readonly SyntaxNode[], fact: (value: SyntaxNode) => T | undefined): T | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const first = fact(values[0]);
  const first_key = JSON.stringify(first);
  return values.every((value) => JSON.stringify(fact(value)) === first_key) ? first : undefined;
}
