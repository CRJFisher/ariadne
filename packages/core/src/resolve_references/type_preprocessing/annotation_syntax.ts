/**
 * The bracket-aware scanning every annotation grammar shares: splitting on a
 * separator only where it is not nested inside a bracket pair or a string, and
 * reading `Head<args>` / `Head[args]` apart. Each language leaf decides which
 * separators and brackets mean what; this file only knows how to count depth.
 */

import type { SymbolName } from "@ariadnejs/types";

const CLOSER_OF: Readonly<Record<string, string>> = {
  "<": ">",
  "[": "]",
  "(": ")",
  "{": "}",
};

const CLOSERS = new Set(Object.values(CLOSER_OF));

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** One structural character outside every quoted string, with the depth around it. */
interface StructuralCharacter {
  readonly index: number;
  readonly char: string;
  /** Bracket depth before an opener is counted and after a closer is. */
  readonly depth: number;
  readonly kind: "open" | "close" | "other";
}

/**
 * Every character of `text` that sits outside a quoted string, classified as a
 * bracket opener, a closer, or anything else, with the bracket depth it sits
 * at. One scanner serves every reader, so a bracket inside a string literal
 * type (`Record<"a>", B>`) is invisible to all of them alike.
 *
 * An arrow (`=>` in TypeScript, `->` in Rust) spells a `>` that opened nothing,
 * and a Rust lifetime (`'a`) opens no string, having no closing quote.
 */
function* scan_structure(text: string): Generator<StructuralCharacter> {
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      const is_lifetime =
        char === "'" && /[A-Za-z_]/.test(text[index + 1] ?? "") && text[index + 2] !== "'";
      if (!is_lifetime) quote = char;
      continue;
    }
    if (char in CLOSER_OF) {
      yield { index, char, depth, kind: "open" };
      depth++;
    } else if (CLOSERS.has(char) && !(char === ">" && (text[index - 1] === "=" || text[index - 1] === "-"))) {
      depth--;
      yield { index, char, depth, kind: "close" };
    } else {
      yield { index, char, depth, kind: "other" };
    }
  }
}

/**
 * Split `text` at every occurrence of `separator` that sits outside every
 * bracket pair and every quoted string. Parts are trimmed; an empty part (a
 * leading `| A`) is kept so the caller can decide what it means.
 */
export function split_at_top_level(text: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;

  for (const { index, depth, kind } of scan_structure(text)) {
    if (kind === "other" && depth === 0 && index >= start && text.startsWith(separator, index)) {
      parts.push(text.slice(start, index).trim());
      start = index + separator.length;
    }
  }

  parts.push(text.slice(start).trim());
  return parts;
}

/** An annotation read apart into the text of its head and of each argument. */
export interface TypeApplicationText {
  readonly head_text: string;
  readonly argument_texts: readonly string[];
}

/**
 * Read `Head<A, B>` (or `Head[A, B]` with `open` `[`) into its head and argument
 * texts. An annotation with no top-level `open` is all head. Returns null when
 * the bracket opened at top level does not close at the very end — `A<B>[]`,
 * `Foo<T>::Assoc` — because the text is then not one application.
 */
export function split_type_application(
  text: string,
  open: "<" | "["
): TypeApplicationText | null {
  let open_index = -1;
  let close_index = -1;

  for (const { index, char, depth, kind } of scan_structure(text)) {
    if (kind === "open" && depth === 0 && char === open && open_index < 0) {
      open_index = index;
    } else if (kind === "close" && depth === 0 && open_index >= 0 && close_index < 0) {
      close_index = index;
    }
  }

  if (open_index < 0) {
    return { head_text: text.trim(), argument_texts: [] };
  }
  if (close_index !== text.length - 1 || text[close_index] !== CLOSER_OF[open]) {
    return null;
  }

  const inner = text.slice(open_index + 1, -1).trim();
  return {
    head_text: text.slice(0, open_index).trim(),
    argument_texts: inner.length === 0 ? [] : split_at_top_level(inner, ","),
  };
}

/**
 * The name chain of a qualified head (`vfs.FileSystem`, `crate::a::State`), or
 * null when any segment is not a plain identifier — a keyword phrase
 * (`typeof X`), a literal, or an expression the grammar leaf did not reduce.
 */
export function parse_qualified_head(
  head_text: string,
  separator: "." | "::"
): readonly SymbolName[] | null {
  const segments = head_text.split(separator).map((segment) => segment.trim());
  if (segments.some((segment) => !IDENTIFIER.test(segment))) {
    return null;
  }
  return segments as SymbolName[];
}

/**
 * The text inside one pair of brackets wrapping the whole of `text`, or null
 * when `text` is not wrapped — `(A)` yields `A`, while `(A) => B` and `(A)[]`
 * yield null because the opening bracket closes before the end.
 */
export function unwrap_enclosing(text: string, open: "(" | "{"): string | null {
  if (!text.startsWith(open)) {
    return null;
  }
  for (const { index, char, depth, kind } of scan_structure(text)) {
    if (kind === "close" && depth === 0) {
      return index === text.length - 1 && char === CLOSER_OF[open]
        ? text.slice(1, -1).trim()
        : null;
    }
  }
  return null;
}
