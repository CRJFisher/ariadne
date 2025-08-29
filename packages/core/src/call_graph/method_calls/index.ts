/**
 * Method call detection and resolution
 *
 * Dispatcher for language-specific method call detection
 */

import { MethodCallInfo } from "@ariadnejs/types";
import { MethodCallContext } from "./method_calls";
import { find_method_calls_javascript } from "./method_calls.javascript";
import { find_method_calls_typescript } from "./method_calls.typescript";
import { find_method_calls_python } from "./method_calls.python";
import { find_method_calls_rust } from "./method_calls.rust";

/**
 * Find all method calls in code
 *
 * Dispatches to language-specific implementations based on the language parameter.
 * Each implementation handles the unique syntax and patterns of its language.
 *
 * @param context The context containing source code, AST, and metadata
 * @returns Array of method call information
 */
export function find_method_calls(
  context: MethodCallContext
): MethodCallInfo[] {
  switch (context.language) {
    case "javascript":
      return find_method_calls_javascript(context);

    case "typescript":
      return find_method_calls_typescript(context);

    case "python":
      return find_method_calls_python(context);

    case "rust":
      return find_method_calls_rust(context);

    default:
      // Return empty array for unsupported languages
      return [];
  }
}
