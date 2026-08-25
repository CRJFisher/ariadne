/**
 * WHICH files an arm sees.
 *
 * Slices are prefixes of the path-sorted discovery list, so every smaller
 * slice is contained in every larger one and a cost-per-file curve describes
 * one codebase growing rather than several unrelated corpora.
 */

import { describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import { nested_slice, plan_nested_slices } from "./nested_slice";

const FILES = [
  "/c/a.ts",
  "/c/b.ts",
  "/c/c.ts",
  "/c/d.ts",
  "/c/e.ts",
] as FilePath[];

describe("nested_slice", () => {
  it("takes a prefix, so every smaller slice is contained in every larger", () => {
    const small = nested_slice(FILES, 2);
    const large = nested_slice(FILES, 4);
    expect(small).toEqual(["/c/a.ts", "/c/b.ts"]);
    expect(large.slice(0, small.length)).toEqual(small);
  });

  it("takes the whole corpus when the slice is its length", () => {
    expect(nested_slice(FILES, 5)).toEqual([...FILES]);
  });

  it("refuses a non-positive size", () => {
    expect(() => nested_slice(FILES, 0)).toThrow(/must be positive/);
  });

  it("refuses a slice larger than the corpus rather than clamping it", () => {
    // A clamped slice would run a different file set than the one asked for,
    // under the name of the one asked for.
    expect(() => nested_slice(FILES, 6)).toThrow(/but the corpus holds 5/);
  });
});

describe("plan_nested_slices", () => {
  it("drops sizes the corpus cannot supply and ends at the full corpus", () => {
    // Two clamped slices would be one file set under two names, and a curve
    // drawn through them would show flat growth that never happened.
    expect(
      plan_nested_slices(new Array(150).fill("/c/x.ts") as FilePath[]),
    ).toEqual([50, 100, 150]);
  });

  it("keeps every size below the corpus and appends its length", () => {
    expect(
      plan_nested_slices(new Array(2500).fill("/c/x.ts") as FilePath[]),
    ).toEqual([50, 100, 200, 1200, 2000, 2500]);
  });

  it("plans only the full corpus when nothing smaller fits", () => {
    expect(plan_nested_slices(FILES)).toEqual([5]);
  });

  it("refuses an empty corpus rather than planning a zero-file slice", () => {
    expect(() => plan_nested_slices([])).toThrow(/empty corpus/);
  });
});
