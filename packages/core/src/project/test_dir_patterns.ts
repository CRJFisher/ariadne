/**
 * Directory-name fragments that mark a file as a test by location.
 *
 * `__tests__` and `__fixtures__` are deliberately unanchored (a `foo__tests__`
 * dir matches) while `/tests`, `/test` and `/fixtures` are slash-anchored so
 * names like `mytests` never match.
 *
 * Fixture trees are marked here rather than excluded from discovery: a fixture
 * that calls production code carries a real call edge, and dropping the file
 * would delete the edge along with the callable. Marking it instead keeps the
 * edge and lets `include_tests` decide whether its own callables are reported.
 */
export const TEST_DIR_PATTERNS = [
  "__tests__",
  "/tests",
  "/test",
  "__fixtures__",
  "/fixtures",
] as const;

export function is_in_test_dir(dir_name: string): boolean {
  return TEST_DIR_PATTERNS.some(
    (pattern) =>
      dir_name.endsWith(pattern) || dir_name.includes(`${pattern}/`),
  );
}
