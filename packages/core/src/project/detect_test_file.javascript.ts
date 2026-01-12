/**
 * JavaScript test file detection
 *
 * Patterns:
 * - *.test.js, *.test.jsx (Jest, Vitest)
 * - *.spec.js, *.spec.jsx (Jest, Vitest)
 * - *.e2e.js, *.e2e.jsx (End-to-end tests)
 * - *.e2e-spec.js (Angular e2e)
 * - *.integration.js, *.integration.jsx (Integration tests)
 * - __tests__/*.js, __tests__/*.jsx (Jest convention)
 * - tests/*.js, tests/*.jsx (Common convention)
 * - test/*.js, test/*.jsx (Common convention)
 */

import { basename, dirname } from "path";

/**
 * Check if a file path matches JavaScript test file patterns
 */
export function is_test_file_javascript(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  // Pattern: *.test.js, *.test.jsx
  if (file_name.endsWith(".test.js") || file_name.endsWith(".test.jsx")) {
    return true;
  }

  // Pattern: *.spec.js, *.spec.jsx
  if (file_name.endsWith(".spec.js") || file_name.endsWith(".spec.jsx")) {
    return true;
  }

  // Pattern: *.e2e.js, *.e2e.jsx (End-to-end tests)
  if (file_name.endsWith(".e2e.js") || file_name.endsWith(".e2e.jsx")) {
    return true;
  }

  // Pattern: *.e2e-spec.js (Angular e2e convention)
  if (file_name.endsWith(".e2e-spec.js")) {
    return true;
  }

  // Pattern: *.integration.js, *.integration.jsx
  if (file_name.endsWith(".integration.js") || file_name.endsWith(".integration.jsx")) {
    return true;
  }

  // Pattern: __tests__/*.js, __tests__/*.jsx (Jest convention)
  if (dir_name.endsWith("__tests__") || dir_name.includes("__tests__/")) {
    return true;
  }

  // Pattern: tests/*.js, tests/*.jsx (Common convention - plural)
  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  // Pattern: test/*.js, test/*.jsx (Common convention - singular)
  if (dir_name.endsWith("/test") || dir_name.includes("/test/")) {
    return true;
  }

  return false;
}
