/**
 * Test file detection
 *
 * Provides language-aware test file detection for filtering test files
 * from analysis when desired.
 */

import type { Language } from "@ariadnejs/types";
import { is_test_file_typescript } from "./detect_test_file.typescript";
import { is_test_file_javascript } from "./detect_test_file.javascript";
import { is_test_file_python } from "./detect_test_file.python";
import { is_test_file_rust } from "./detect_test_file.rust";

/**
 * Check if a file path is a test file based on language-specific conventions.
 *
 * @param file_path - The file path to check
 * @param language - The language of the file
 * @returns true if the file is a test file, false otherwise
 */
export function is_test_file(file_path: string, language: Language): boolean {
  switch (language) {
    case "typescript":
      return is_test_file_typescript(file_path);
    case "javascript":
      return is_test_file_javascript(file_path);
    case "python":
      return is_test_file_python(file_path);
    case "rust":
      return is_test_file_rust(file_path);
    default:
      return false;
  }
}
