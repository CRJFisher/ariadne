/**
 * JSDoc type grammar: the TypeScript grammar plus JSDoc's own modifiers —
 * `{X}` braces, optional `X=`, nullable `?X`, non-nullable `!X`, and the
 * `Array.<X>` application spelling.
 */

import type { ParsedTypeAnnotation } from "./annotation";
import { unwrap_enclosing } from "./annotation_syntax";
import { parse_typescript_annotation } from "./annotation.typescript";

/**
 * Parse a JSDoc type. The indexer stores the text inside the braces, but a
 * braced form parses the same, so `{X}` and `X` agree.
 *
 * A variadic `...X` parses to null: the binding holds a list of `X`, not an
 * `X`, and naming the list type would be a guess.
 */
export function parse_javascript_annotation(text: string): ParsedTypeAnnotation | null {
  let annotation = text.trim();

  const braced = unwrap_enclosing(annotation, "{");
  if (braced !== null) {
    annotation = braced;
  }

  if (annotation.startsWith("...")) {
    return null;
  }

  while (annotation.startsWith("?") || annotation.startsWith("!")) {
    annotation = annotation.slice(1).trim();
  }
  while (annotation.endsWith("=") || annotation.endsWith("!")) {
    annotation = annotation.slice(0, -1).trim();
  }

  return parse_typescript_annotation(annotation.split(".<").join("<"));
}
