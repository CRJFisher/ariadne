/**
 * TypeScript test file detection
 *
 * Patterns:
 * - *.test.ts, *.test.tsx (Jest, Vitest)
 * - *.spec.ts, *.spec.tsx (Jest, Vitest)
 * - *.e2e.ts, *.e2e.tsx (End-to-end tests)
 * - *.e2e-spec.ts (Angular e2e)
 * - *.integration.ts, *.integration.tsx (Integration tests)
 * - __tests__/*.ts, __tests__/*.tsx (Jest convention)
 * - tests/*.ts, tests/*.tsx (Common convention)
 * - test/*.ts, test/*.tsx (Common convention)
 */

import { basename, dirname } from "path";

/**
 * Check if a file path matches TypeScript test file patterns
 */
export function is_test_file_typescript(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  // Pattern: *.test.ts, *.test.tsx
  if (file_name.endsWith(".test.ts") || file_name.endsWith(".test.tsx")) {
    return true;
  }

  // Pattern: *.spec.ts, *.spec.tsx
  if (file_name.endsWith(".spec.ts") || file_name.endsWith(".spec.tsx")) {
    return true;
  }

  // Pattern: *.e2e.ts, *.e2e.tsx (End-to-end tests)
  if (file_name.endsWith(".e2e.ts") || file_name.endsWith(".e2e.tsx")) {
    return true;
  }

  // Pattern: *.e2e-spec.ts (Angular e2e convention)
  if (file_name.endsWith(".e2e-spec.ts")) {
    return true;
  }

  // Pattern: *.integration.ts, *.integration.tsx
  if (file_name.endsWith(".integration.ts") || file_name.endsWith(".integration.tsx")) {
    return true;
  }

  // Pattern: __tests__/*.ts, __tests__/*.tsx (Jest convention)
  if (dir_name.endsWith("__tests__") || dir_name.includes("__tests__/")) {
    return true;
  }

  // Pattern: tests/*.ts, tests/*.tsx (Common convention - plural)
  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  // Pattern: test/*.ts, test/*.tsx (Common convention - singular)
  if (dir_name.endsWith("/test") || dir_name.includes("/test/")) {
    return true;
  }

  return false;
}
