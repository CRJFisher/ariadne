/**
 * Python callable shapes: `Callable[[A, B], R]`, read by its last segment so
 * `typing.Callable` and `collections.abc.Callable` agree, inside `Optional[…]`
 * or a union with `None`.
 */

import type { CallableParameters } from "./callable_shape";
import { split_at_top_level, split_type_application } from "./annotation_syntax";

export function callable_parameters_python(text: string): CallableParameters | null {
  let annotation = text.trim();
  if (/^(['"]).*\1$/.test(annotation)) {
    annotation = annotation.slice(1, -1).trim();
  }

  const members = split_at_top_level(annotation, "|").filter((member) => member !== "None");
  if (members.length !== 1) {
    return null;
  }
  const application = split_type_application(members[0], "[");
  const head = application?.head_text.split(".").pop();
  if (!application || head === undefined) {
    return null;
  }
  if (head === "Optional" && application.argument_texts.length === 1) {
    return callable_parameters_python(application.argument_texts[0]);
  }
  if (head === "Union") {
    const typed = application.argument_texts.filter((argument) => argument !== "None");
    return typed.length === 1 ? callable_parameters_python(typed[0]) : null;
  }
  if (head !== "Callable" || application.argument_texts.length !== 2) {
    return null;
  }
  const parameter_list = application.argument_texts[0];
  if (!parameter_list.startsWith("[") || !parameter_list.endsWith("]")) {
    return null;
  }
  const inner = parameter_list.slice(1, -1).trim();
  return inner.length === 0 ? [] : split_at_top_level(inner, ",").filter((parameter) => parameter.length > 0);
}
