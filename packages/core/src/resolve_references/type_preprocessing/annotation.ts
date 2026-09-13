/**
 * Reads a type annotation's source text into the structure a type lookup
 * needs: the qualified name of the type it denotes and its type arguments.
 *
 * Pure and registry-free. Every wrapper that does not change which type's
 * members a receiver reaches — a nullable union, a reference, a `dyn`/`impl`
 * bound, a quoted forward reference — is removed here, so the resolver looks
 * up exactly one declared name chain. Anything the grammar cannot reduce to a
 * single named type (an intersection, a function type, a tuple, a union of two
 * real types) parses to null rather than to a guess.
 */

import type { Language, SymbolName } from "@ariadnejs/types";
import { parse_javascript_annotation } from "./annotation.javascript";
import { parse_python_annotation } from "./annotation.python";
import { parse_rust_annotation } from "./annotation.rust";
import { parse_typescript_annotation } from "./annotation.typescript";

export interface ParsedTypeAnnotation {
  /** Qualified name chain of the head, e.g. `["vfs", "FileSystem"]`. */
  readonly head: readonly SymbolName[];
  /** Type arguments, parsed recursively. Empty for a non-generic annotation. */
  readonly arguments: readonly ParsedTypeAnnotation[];
  /**
   * @language javascript,typescript
   * The module an inline import type names (`import("./a").X`); `head` is then
   * looked up among that module's members rather than in lexical scope.
   */
  readonly module_specifier?: string;
}

/**
 * Parse `text` under `language`'s annotation grammar, or return null when the
 * text does not denote one named type.
 */
export function parse_type_annotation(
  text: string,
  language: Language
): ParsedTypeAnnotation | null {
  switch (language) {
    case "typescript":
      return parse_typescript_annotation(text);
    case "javascript":
      return parse_javascript_annotation(text);
    case "python":
      return parse_python_annotation(text);
    case "rust":
      return parse_rust_annotation(text);
  }
}
