/**
 * Rust annotation grammar: references and lifetimes, `dyn`/`impl` bounds,
 * `<…>` arguments, `::`-qualified heads, and the fixed set of wrappers whose
 * methods a receiver reaches through the wrapped type.
 */

import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import {
  parse_qualified_head,
  split_at_top_level,
  split_type_application,
  unwrap_enclosing,
} from "./annotation_syntax";

/**
 * Wrappers that denote their single argument. `Box`/`Rc`/`Arc` deref to it, and
 * an `Option` receiver is overwhelmingly unwrapped (`x?.m()`, `if let Some(x)`)
 * before its call. The list is fixed and short because it is the one place a
 * wrong entry produces a false edge rather than a missed one: `Vec<T>` stays a
 * `Vec`, since `v.len()` is `Vec`'s own method.
 */
const TRANSPARENT_WRAPPERS: ReadonlySet<string> = new Set(["Option", "Box", "Rc", "Arc"]);

const STANDARD_CRATES: ReadonlySet<string> = new Set(["std", "core", "alloc"]);

const REFERENCE_PREFIX = /^&\s*(?:'[A-Za-z_][A-Za-z0-9_]*\s+)?(?:mut\s+)?/;

const LIFETIME = /^'[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parse a Rust annotation.
 *
 * A `dyn`/`impl` bound list names its type by its first trait: `?Sized` and
 * lifetimes constrain it without naming anything a method is called on, and the
 * auto traits (`Send`, `Sync`) follow the principal trait by convention.
 */
export function parse_rust_annotation(text: string): ParsedTypeAnnotation | null {
  let annotation = text.trim();

  const reference = REFERENCE_PREFIX.exec(annotation);
  if (reference && reference[0].length > 0) {
    return parse_rust_annotation(annotation.slice(reference[0].length));
  }

  const parenthesised = unwrap_enclosing(annotation, "(");
  if (parenthesised !== null) {
    return split_at_top_level(parenthesised, ",").length === 1
      ? parse_rust_annotation(parenthesised)
      : null;
  }

  for (const keyword of ["dyn ", "impl "]) {
    if (annotation.startsWith(keyword)) {
      const bounds = split_at_top_level(annotation.slice(keyword.length), "+").filter(
        (bound) => bound.length > 0 && !bound.startsWith("?") && !LIFETIME.test(bound)
      );
      return bounds.length > 0 ? parse_rust_annotation(bounds[0]) : null;
    }
  }

  if (annotation.startsWith("::")) {
    annotation = annotation.slice(2);
  }

  const application = split_type_application(annotation, "<");
  if (!application) {
    return null;
  }

  const head = parse_qualified_head(application.head_text, "::");
  if (!head) {
    return null;
  }

  const type_arguments: ParsedTypeAnnotation[] = [];
  for (const argument_text of application.argument_texts) {
    if (LIFETIME.test(argument_text)) {
      continue;
    }
    const argument = parse_rust_annotation(argument_text);
    if (!argument) {
      return null;
    }
    type_arguments.push(argument);
  }

  if (is_transparent_wrapper(head) && type_arguments.length === 1) {
    return type_arguments[0];
  }

  return { head, arguments: type_arguments };
}

/**
 * A wrapper is the standard library's only when written bare (the prelude or a
 * `use`) or through a standard crate path; `widgets::Option<Config>` is the
 * author's own type and keeps its head.
 */
function is_transparent_wrapper(head: readonly SymbolName[]): boolean {
  const is_standard_path = head.length === 1 || STANDARD_CRATES.has(head[0]);
  return is_standard_path && TRANSPARENT_WRAPPERS.has(head[head.length - 1]);
}
