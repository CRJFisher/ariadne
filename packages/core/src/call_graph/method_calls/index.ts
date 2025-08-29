/**
 * Method call detection and resolution
 *
 * Dispatcher for language-specific method call detection
 */

import { MethodCallInfo } from "@ariadnejs/types";
import { MethodCallContext } from "./method_calls";

// Re-export types
export { MethodCallInfo } from "@ariadnejs/types";
export { MethodCallContext } from "./method_calls";
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
 * @param type_map Optional map of variable types for resolving receiver types (from Layer 3)
 * @param class_hierarchy Optional class hierarchy for virtual method resolution (from Layer 6)
 * @returns Array of method call information
 */
export function find_method_calls(
  context: MethodCallContext,
  type_map?: Map<string, any>, // From type_tracking - Layer 3
  class_hierarchy?: Map<string, any> // From class_hierarchy - Layer 6
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
