import { describe, expect, it } from "vitest";

import { TEST_DIR_PATTERNS, is_in_test_dir } from "./test_dir_patterns";

describe("TEST_DIR_PATTERNS", () => {
  it("holds the exact shared pattern set", () => {
    expect(TEST_DIR_PATTERNS).toEqual([
      "__tests__",
      "/tests",
      "/test",
      "__fixtures__",
      "/fixtures",
    ]);
  });
});

describe("is_in_test_dir", () => {
  it("matches a __tests__ directory as leaf and as ancestor", () => {
    expect(is_in_test_dir("/src/__tests__")).toEqual(true);
    expect(is_in_test_dir("/src/__tests__/unit")).toEqual(true);
  });

  it("matches __tests__ without a leading slash anchor", () => {
    expect(is_in_test_dir("/src/foo__tests__")).toEqual(true);
  });

  it("matches slash-anchored tests and test directories", () => {
    expect(is_in_test_dir("/project/tests")).toEqual(true);
    expect(is_in_test_dir("/project/tests/unit")).toEqual(true);
    expect(is_in_test_dir("/project/test")).toEqual(true);
    expect(is_in_test_dir("/project/test/fixtures")).toEqual(true);
  });

  it("rejects names that merely contain test as a substring", () => {
    expect(is_in_test_dir("/src/mytests")).toEqual(false);
    expect(is_in_test_dir("/src/contest")).toEqual(false);
    expect(is_in_test_dir("/src/latest/code")).toEqual(false);
    expect(is_in_test_dir("/src/testing")).toEqual(false);
  });
});
