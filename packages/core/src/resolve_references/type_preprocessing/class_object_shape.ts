/**
 * The annotations that denote a class object rather than an instance of the
 * class, and the class they name.
 *
 * - Python `type[X]` and `typing.Type[X]`, read by the last head segment as
 *   `Optional` is.
 * - TypeScript and JSDoc `typeof X`.
 *
 * Calling a class object constructs its class, where calling an instance
 * dispatches to the instance's `__call__`, so a callable declared to return one
 * of these yields a class object, never an instance.
 */

import type { Language } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";

const CLASS_OBJECT_HEADS: Readonly<Record<Language, ReadonlySet<string>>> = {
  python: new Set(["type", "Type"]),
  typescript: new Set(["typeof"]),
  javascript: new Set(["typeof"]),
  rust: new Set(),
};

/**
 * The annotation of the class `annotation` denotes the class object of, or null
 * when `annotation` denotes anything else.
 */
export function class_object_annotation(
  annotation: ParsedTypeAnnotation,
  language: Language
): ParsedTypeAnnotation | null {
  const head_name = annotation.head[annotation.head.length - 1];
  if (
    !CLASS_OBJECT_HEADS[language].has(head_name) ||
    annotation.arguments.length !== 1 ||
    annotation.module_specifier !== undefined
  ) {
    return null;
  }
  return annotation.arguments[0];
}
