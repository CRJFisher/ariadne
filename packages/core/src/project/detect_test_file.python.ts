/**
 * Python test file detection
 *
 * Patterns:
 * - test_*.py (pytest convention)
 * - *_test.py (pytest convention)
 * - conftest.py (pytest fixtures)
 * - tests/*.py (tests directory - plural)
 * - test/*.py (test directory - singular)
 */

import { basename, dirname } from "path";

/**
 * Check if a file path matches Python test file patterns
 */
export function is_test_file_python(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  // Pattern: test_*.py
  if (file_name.startsWith("test_") && file_name.endsWith(".py")) {
    return true;
  }

  // Pattern: *_test.py
  if (file_name.endsWith("_test.py")) {
    return true;
  }

  // Pattern: conftest.py (pytest fixtures)
  if (file_name === "conftest.py") {
    return true;
  }

  // Pattern: tests/*.py (plural)
  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  // Pattern: test/*.py (singular)
  if (dir_name.endsWith("/test") || dir_name.includes("/test/")) {
    return true;
  }

  return false;
}
