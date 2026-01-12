/**
 * Rust test file detection
 *
 * Patterns:
 * - *_test.rs (test file naming convention)
 * - tests/*.rs (integration tests directory)
 * - benches/*.rs (benchmark tests directory)
 */

import { basename, dirname } from "path";

/**
 * Check if a file path matches Rust test file patterns
 */
export function is_test_file_rust(file_path: string): boolean {
  const file_name = basename(file_path);
  const dir_name = dirname(file_path);

  // Pattern: *_test.rs
  if (file_name.endsWith("_test.rs")) {
    return true;
  }

  // Pattern: tests/*.rs (integration tests)
  if (dir_name.endsWith("/tests") || dir_name.includes("/tests/")) {
    return true;
  }

  // Pattern: benches/*.rs (benchmark tests)
  if (dir_name.endsWith("/benches") || dir_name.includes("/benches/")) {
    return true;
  }

  return false;
}
