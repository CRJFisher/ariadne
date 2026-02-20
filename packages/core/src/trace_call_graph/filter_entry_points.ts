/**
 * Entry Point Filtering
 *
 * Filters symbols that should not appear in entry point detection based on
 * language-specific rules. This handles framework-invoked methods that
 * cannot be traced through static call graph analysis.
 *
 * Currently supported:
 * - Python: Filters dunder methods (`__str__`, `__repr__`, etc.) that are
 *   called by the Python runtime rather than user code.
 */

import type { FilePath, Language, SymbolName } from "@ariadnejs/types";
import { should_filter_python_entry_point } from "./filter_entry_points.python";

/**
 * Detect language from file extension.
 */
function detect_language(file_path: FilePath): Language {
  const ext = file_path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript" as Language;
    case "js":
    case "jsx":
      return "javascript" as Language;
    case "py":
      return "python" as Language;
    case "rs":
      return "rust" as Language;
    default:
      return "typescript" as Language;
  }
}

/**
 * Determine if a symbol should be filtered from entry points.
 *
 * Dispatches to language-specific filters based on the file path.
 *
 * @param name - The symbol name to check
 * @param file_path - File path for language detection
 * @returns true if the symbol should be filtered out, false otherwise
 */
export function should_filter_entry_point(
  name: SymbolName,
  file_path: FilePath
): boolean {
  const language = detect_language(file_path);

  switch (language) {
    case "python":
      return should_filter_python_entry_point(name);
    default:
      return false;
  }
}
