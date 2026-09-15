/**
 * TypeScript annotation grammar: nullish unions, `readonly`, `T[]`, `<…>`
 * arguments, dotted heads, `typeof X` and inline `import("…")` types.
 */

import type { SymbolName } from "@ariadnejs/types";
import type { ParsedTypeAnnotation } from "./annotation";
import {
  parse_qualified_head,
  split_at_top_level,
  split_type_application,
  unwrap_enclosing,
} from "./annotation_syntax";

const NULLISH = new Set(["null", "undefined"]);

const ARRAY = "Array" as SymbolName;

const TYPEOF = "typeof" as SymbolName;

const TYPEOF_PREFIX = "typeof ";

const INLINE_IMPORT = /^import\(\s*(["'])([^"']+)\1\s*\)\s*\.(.+)$/s;

/**
 * Parse a TypeScript annotation. Also the grammar JSDoc types reduce to once
 * their own modifiers are stripped.
 *
 * `F | null` and `F | undefined` denote `F`: a member call only runs on the
 * non-nullish arm. `F[]` is `Array<F>`, so the element stays an argument and
 * never becomes the receiver type — `xs.push()` is `Array`'s method.
 * `typeof X` keeps `typeof` as its head and `X` as its argument, as Python's
 * `type[X]` does: it denotes the class object `X` names, not an instance.
 */
export function parse_typescript_annotation(text: string): ParsedTypeAnnotation | null {
  let annotation = text.trim();

  const parenthesised = unwrap_enclosing(annotation, "(");
  if (parenthesised !== null) {
    return parse_typescript_annotation(parenthesised);
  }

  const union_members = split_at_top_level(annotation, "|").filter(
    (member) => member.length > 0
  );
  if (union_members.length > 1) {
    const typed_members = union_members.filter((member) => !NULLISH.has(member));
    return typed_members.length === 1
      ? parse_typescript_annotation(typed_members[0])
      : null;
  }
  annotation = union_members[0] ?? "";

  if (annotation.startsWith("readonly ")) {
    return parse_typescript_annotation(annotation.slice("readonly ".length));
  }

  if (annotation.startsWith(TYPEOF_PREFIX)) {
    const operand = parse_qualified_head(annotation.slice(TYPEOF_PREFIX.length).trim(), ".");
    return operand ? { head: [TYPEOF], arguments: [{ head: operand, arguments: [] }] } : null;
  }

  if (annotation.endsWith("?")) {
    return parse_typescript_annotation(annotation.slice(0, -1));
  }

  if (annotation.endsWith("[]")) {
    const element = parse_typescript_annotation(annotation.slice(0, -2));
    return element ? { head: [ARRAY], arguments: [element] } : null;
  }

  const inline_import = INLINE_IMPORT.exec(annotation);
  if (inline_import) {
    const imported = parse_typescript_annotation(inline_import[3]);
    return imported ? { ...imported, module_specifier: inline_import[2] } : null;
  }

  return parse_application(annotation);
}

function parse_application(annotation: string): ParsedTypeAnnotation | null {
  const application = split_type_application(annotation, "<");
  if (!application) {
    return null;
  }

  const head = parse_qualified_head(application.head_text, ".");
  if (!head) {
    return null;
  }

  const type_arguments: ParsedTypeAnnotation[] = [];
  for (const argument_text of application.argument_texts) {
    const argument = parse_typescript_annotation(argument_text);
    if (!argument) {
      return null;
    }
    type_arguments.push(argument);
  }

  return { head, arguments: type_arguments };
}
