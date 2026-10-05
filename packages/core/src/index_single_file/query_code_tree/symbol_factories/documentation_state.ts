import type { Language } from "@ariadnejs/types";
import { reset_documentation_state as reset_javascript } from "./documentation_state.javascript";
import { reset_documentation_state as reset_python } from "./documentation_state.python";
import { reset_documentation_state as reset_rust } from "./documentation_state.rust";

/**
 * Reset the language's pending-documentation store between file indexing
 * passes to prevent cross-file documentation contamination.
 *
 * TypeScript shares the JavaScript store, so both switch arms reset it.
 */
export function reset_documentation_state(language: Language): void {
  switch (language) {
    case "javascript":
    case "typescript":
      reset_javascript();
      return;
    case "python":
      reset_python();
      return;
    case "rust":
      reset_rust();
      return;
  }
}
