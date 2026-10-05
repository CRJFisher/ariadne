/**
 * TypeScript callable shapes: an arrow function type `(a: A, b?: B) => R`,
 * parenthesised or in a union with `null`/`undefined`.
 */

import type { CallableParameters } from "./callable_shape";
import { split_at_top_level, unwrap_enclosing } from "./annotation_syntax";

const NULLISH: ReadonlySet<string> = new Set(["null", "undefined"]);

export function callable_parameters_typescript(text: string): CallableParameters | null {
  const annotation = text.trim();

  const members = split_at_top_level(annotation, "|").filter((member) => member.length > 0 && !NULLISH.has(member));
  if (members.length !== 1) {
    return null;
  }
  if (members[0] !== annotation) {
    return callable_parameters_typescript(members[0]);
  }

  const parenthesised = unwrap_enclosing(annotation, "(");
  if (parenthesised !== null) {
    return callable_parameters_typescript(parenthesised);
  }

  // `(a: A) => (b: B) => C` hands its callable an `A`; the return is another callable.
  const [parameters_text, ...returned] = split_at_top_level(annotation, "=>");
  const parameter_list = returned.length > 0 ? unwrap_enclosing(parameters_text, "(") : null;
  if (parameter_list === null) {
    return null;
  }
  return declared_positions(
    split_at_top_level(parameter_list, ",").filter((parameter) => parameter.length > 0),
    (parameter) => {
      const [name, ...type] = split_at_top_level(parameter, ":");
      return { name, type: type.length > 0 ? type.join(":") : null };
    }
  );
}

/**
 * The type each declared parameter hands its position. A `this` parameter
 * declares the receiver, not a position; a rest parameter takes every position
 * from its own on, so only one written last is countable, and it types none.
 */
export function declared_positions(
  parameters: readonly string[],
  read: (parameter: string) => { readonly name: string; readonly type: string | null }
): CallableParameters | null {
  const positions: (string | null)[] = [];
  for (const [index, parameter] of parameters.entries()) {
    const { name, type } = read(parameter);
    if (name.trim() === "this") {
      continue;
    }
    if (name.trim().startsWith("...")) {
      return index === parameters.length - 1 ? positions : null;
    }
    positions.push(type);
  }
  return positions;
}
