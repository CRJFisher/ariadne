/**
 * JSDoc callable shapes: Closure's `function(A, B): R` and the TypeScript
 * arrow type, inside JSDoc's braces and modifiers.
 */

import type { CallableParameters } from "./callable_shape";
import { bracketed_at, split_at_top_level, unwrap_enclosing } from "./annotation_syntax";
import { callable_parameters_typescript, declared_positions } from "./callable_shape.typescript";

const CLOSURE_FUNCTION = /^function\s*\(/;

export function callable_parameters_javascript(text: string): CallableParameters | null {
  let annotation = text.trim();
  const braced = unwrap_enclosing(annotation, "{");
  if (braced !== null) {
    annotation = braced;
  }
  annotation = annotation.replace(/^[?!]+/, "").replace(/=$/, "").trim();

  if (!CLOSURE_FUNCTION.test(annotation)) {
    return callable_parameters_typescript(annotation);
  }
  const parameter_list = bracketed_at(annotation, annotation.indexOf("("));
  if (parameter_list === null) {
    return null;
  }
  // Closure writes `this:T` and `new:T` where a position would be; neither is one.
  return declared_positions(
    split_at_top_level(parameter_list.inner, ",").filter((parameter) => parameter.length > 0),
    (parameter) => {
      const receiver = /^(this|new)\s*:/.exec(parameter);
      return receiver
        ? { name: "this", type: null }
        : { name: parameter.startsWith("...") ? "..." : "", type: parameter.replace(/=$/, "").trim() };
    }
  );
}
