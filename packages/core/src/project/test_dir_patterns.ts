/**
 * Directory-name fragments that mark a JS/TS file as a test by location.
 * `__tests__` is deliberately unanchored (a `foo__tests__` dir matches) while
 * `/tests` and `/test` are slash-anchored so names like `mytests` never match.
 */
export const TEST_DIR_PATTERNS = ["__tests__", "/tests", "/test"] as const;

export function is_in_test_dir(dir_name: string): boolean {
  return TEST_DIR_PATTERNS.some(
    (pattern) =>
      dir_name.endsWith(pattern) || dir_name.includes(`${pattern}/`),
  );
}
