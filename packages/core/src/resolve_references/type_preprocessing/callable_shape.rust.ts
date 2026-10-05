/**
 * Rust callable shapes: the `Fn`, `FnMut` and `FnOnce` traits, written as an
 * `impl`/`dyn` bound, bare as a generic's bound, or behind a reference or a
 * `Box`/`Rc`/`Arc`.
 */

import type { CallableParameters } from "./callable_shape";
import { bracketed_at, split_at_top_level, split_type_application, unwrap_enclosing } from "./annotation_syntax";

const FN_TRAIT = /^(?:(?:::)?(?:std|core)::ops::)?(?:Fn|FnMut|FnOnce)\s*\(/;

const REFERENCE_PREFIX = /^&\s*(?:'[A-Za-z_][A-Za-z0-9_]*\s+)?(?:mut\s+)?/;

const HIGHER_RANKED = /^for\s*<[^>]*>\s*/;

const POINTERS: ReadonlySet<string> = new Set(["Box", "Rc", "Arc"]);

export function callable_parameters_rust(text: string): CallableParameters | null {
  const annotation = text.trim().replace(REFERENCE_PREFIX, "").replace(HIGHER_RANKED, "");

  const parenthesised = unwrap_enclosing(annotation, "(");
  if (parenthesised !== null) {
    return split_at_top_level(parenthesised, ",").length === 1 ? callable_parameters_rust(parenthesised) : null;
  }

  for (const keyword of ["dyn ", "impl "]) {
    if (annotation.startsWith(keyword)) {
      const fn_bound = split_at_top_level(annotation.slice(keyword.length), "+").find((bound) =>
        FN_TRAIT.test(bound.replace(HIGHER_RANKED, ""))
      );
      return fn_bound === undefined ? null : callable_parameters_rust(fn_bound);
    }
  }

  if (FN_TRAIT.test(annotation)) {
    const parameter_list = bracketed_at(annotation, annotation.indexOf("("));
    return parameter_list === null
      ? null
      : split_at_top_level(parameter_list.inner, ",").filter((part) => part.length > 0);
  }

  const application = split_type_application(annotation, "<");
  const pointer = application?.head_text.split("::").pop();
  return application && pointer !== undefined && POINTERS.has(pointer) && application.argument_texts.length === 1
    ? callable_parameters_rust(application.argument_texts[0])
    : null;
}
