/**
 * The file sets and arrival orders an arm ingests.
 *
 * Two properties carry the ACs: slices are nested by construction, so a
 * cost-per-file curve describes one codebase growing rather than several
 * unrelated corpora; and a shuffled order is reproducible from the seed the
 * row records, so a multi-order run can be re-run.
 */

import { describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import {
  INGEST_ORDERS,
  nested_slice,
  order_files,
  plan_nested_slices,
} from "./ingest_order";

const FILES = [
  "/c/a.ts",
  "/c/b.ts",
  "/c/c.ts",
  "/c/d.ts",
  "/c/e.ts",
] as FilePath[];

/** Sizes chosen so the descending order is not the reverse of the path order. */
const SIZES = new Map<FilePath, number>([
  ["/c/a.ts" as FilePath, 300],
  ["/c/b.ts" as FilePath, 100],
  ["/c/c.ts" as FilePath, 500],
  ["/c/d.ts" as FilePath, 100],
  ["/c/e.ts" as FilePath, 200],
]);

describe("order_files", () => {
  it("covers exactly the four orders a multi-order run diffs", () => {
    expect([...INGEST_ORDERS]).toEqual([
      "forward",
      "reversed",
      "descending_size",
      "shuffled",
    ]);
  });

  it("leaves the path-sorted order alone going forward", () => {
    expect(order_files(FILES, "forward", { file_sizes: SIZES, seed: 1 })).toEqual(
      FILES,
    );
  });

  it("reverses the path-sorted order", () => {
    expect(
      order_files(FILES, "reversed", { file_sizes: SIZES, seed: 1 }),
    ).toEqual(["/c/e.ts", "/c/d.ts", "/c/c.ts", "/c/b.ts", "/c/a.ts"]);
  });

  it("orders largest first, breaking ties by ascending path", () => {
    // Descending size is required rather than optional: it scrambles directory
    // locality and reverses the arrival order of the large exported-singleton
    // modules, and it was the order that moved 31 entry points on a tree that
    // forward-versus-reverse alone showed moving by 35.
    expect(
      order_files(FILES, "descending_size", { file_sizes: SIZES, seed: 1 }),
    ).toEqual(["/c/c.ts", "/c/a.ts", "/c/e.ts", "/c/b.ts", "/c/d.ts"]);
  });

  it("refuses a descending-size order it has no size for", () => {
    expect(() =>
      order_files(FILES, "descending_size", {
        file_sizes: new Map(),
        seed: 1,
      }),
    ).toThrow(/needs a byte size for every file/);
  });

  it("shuffles reproducibly from the recorded seed", () => {
    const first = order_files(FILES, "shuffled", { file_sizes: SIZES, seed: 42 });
    const again = order_files(FILES, "shuffled", { file_sizes: SIZES, seed: 42 });
    expect(again).toEqual(first);
  });

  it("shuffles differently under a different seed", () => {
    const at_42 = order_files(FILES, "shuffled", { file_sizes: SIZES, seed: 42 });
    const at_1 = order_files(FILES, "shuffled", { file_sizes: SIZES, seed: 1 });
    expect(at_1).not.toEqual(at_42);
  });

  it("shuffles into a permutation, losing and inventing nothing", () => {
    const shuffled = order_files(FILES, "shuffled", {
      file_sizes: SIZES,
      seed: 7,
    });
    expect([...shuffled].sort()).toEqual([...FILES].sort());
  });
});

describe("nested_slice", () => {
  it("takes a prefix, so every smaller slice is contained in every larger", () => {
    const small = nested_slice(FILES, 2);
    const large = nested_slice(FILES, 4);
    expect(small).toEqual(["/c/a.ts", "/c/b.ts"]);
    expect(large.slice(0, small.length)).toEqual(small);
  });

  it("refuses a non-positive size", () => {
    expect(() => nested_slice(FILES, 0)).toThrow(/must be positive/);
  });
});

describe("plan_nested_slices", () => {
  it("drops sizes the corpus cannot supply and ends at the full corpus", () => {
    // A slice larger than the corpus is dropped rather than clamped: two
    // clamped slices would be one file set under two names, and a curve drawn
    // through them would show flat growth that never happened.
    expect(plan_nested_slices(new Array(150).fill("/c/x.ts") as FilePath[])).toEqual(
      [50, 100, 150],
    );
  });

  it("keeps every size below the corpus and appends its length", () => {
    expect(
      plan_nested_slices(new Array(2500).fill("/c/x.ts") as FilePath[]),
    ).toEqual([50, 100, 200, 1200, 2000, 2500]);
  });

  it("refuses an empty corpus rather than planning a zero-file slice", () => {
    expect(() => plan_nested_slices([])).toThrow(/empty corpus/);
  });
});
