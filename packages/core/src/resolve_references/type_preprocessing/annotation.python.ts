/**
 * Python annotation grammar: `[…]` arguments, dotted heads, quoted forward
 * references, and the two spellings of optionality — `Optional[X]` /
 * `Union[X, None]` and PEP 604's `X | None`.
 */

import type { ParsedTypeAnnotation } from "./annotation";
import {
  parse_qualified_head,
  split_at_top_level,
  split_type_application,
} from "./annotation_syntax";

const NONE = "None";

/**
 * Parse a Python annotation.
 *
 * `Optional` and `Union` are read by their last segment, so `typing.Optional`
 * and `t.Optional` unwrap alike. `type[C]` keeps `type` as its head: it
 * denotes the class object, whose attribute calls are not `C`'s instance
 * methods.
 */
export function parse_python_annotation(text: string): ParsedTypeAnnotation | null {
  const annotation = text.trim();

  const forward_reference = unquote(annotation);
  if (forward_reference !== null) {
    return parse_python_annotation(forward_reference);
  }

  const union_members = split_at_top_level(annotation, "|");
  if (union_members.length > 1) {
    return parse_single_typed_member(union_members);
  }

  const application = split_type_application(annotation, "[");
  if (!application) {
    return null;
  }

  const head = parse_qualified_head(application.head_text, ".");
  if (!head) {
    return null;
  }

  const head_name = head[head.length - 1];
  if (head_name === "Optional") {
    return application.argument_texts.length === 1
      ? parse_python_annotation(application.argument_texts[0])
      : null;
  }
  if (head_name === "Union") {
    return parse_single_typed_member(application.argument_texts);
  }

  const type_arguments: ParsedTypeAnnotation[] = [];
  for (const argument_text of application.argument_texts) {
    const argument = parse_python_annotation(argument_text);
    if (!argument) {
      return null;
    }
    type_arguments.push(argument);
  }

  return { head, arguments: type_arguments };
}

/** The one member of a union that is not `None`, parsed; null when there is not exactly one. */
function parse_single_typed_member(
  members: readonly string[]
): ParsedTypeAnnotation | null {
  const typed_members = members.filter((member) => unquote(member) !== NONE && member !== NONE);
  return typed_members.length === 1 ? parse_python_annotation(typed_members[0]) : null;
}

function unquote(text: string): string | null {
  const quote = text[0];
  if ((quote === "\"" || quote === "'") && text.length >= 2 && text.endsWith(quote)) {
    return text.slice(1, -1).trim();
  }
  return null;
}
