/**
 * The parameter types a function-typed annotation hands the callable it
 * describes — what a callback passed where the annotation is declared
 * receives: `impl FnOnce(&mut Self) -> T` hands `&mut Self`, `(item: Foo, i:
 * number) => void` hands `Foo` and `number`, `Callable[[Foo], None]` hands
 * `Foo`.
 *
 * Pure and registry-free, like the annotation grammars. Each type comes back as
 * annotation text in the declaring language, one entry per declared position
 * and null where a position declares no type, so a callback's parameter takes
 * the entry at its own position. An annotation that is not a function type, or
 * whose positions cannot be counted (`Callable[..., R]`, a rest parameter
 * ahead of the end), answers null.
 */

import type { Language } from "@ariadnejs/types";
import { callable_parameters_javascript } from "./callable_shape.javascript";
import { callable_parameters_python } from "./callable_shape.python";
import { callable_parameters_rust } from "./callable_shape.rust";
import { callable_parameters_typescript } from "./callable_shape.typescript";

export type CallableParameters = readonly (string | null)[];

/** The parameter types `text` hands its callable under `language`'s grammar, or null when it is no function type. */
export function callable_parameter_annotations(text: string, language: Language): CallableParameters | null {
  switch (language) {
    case "typescript":
      return callable_parameters_typescript(text);
    case "javascript":
      return callable_parameters_javascript(text);
    case "python":
      return callable_parameters_python(text);
    case "rust":
      return callable_parameters_rust(text);
  }
}
