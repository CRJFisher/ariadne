/**
 * The sequence a fixed file set arrives in.
 *
 * A shuffled order is reproducible from the seed the row records, so a
 * multi-order run can be re-run; every other order is a function of the corpus
 * alone.
 */

import { describe, expect, it } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { INGEST_ORDERS, measure_file_sizes, order_files } from "./ingest_order";

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

describe("measure_file_sizes", () => {
  it("reads the byte size of every file the descending order needs", async () => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "sizes-")));
    const small = path.join(dir, "small.ts") as FilePath;
    const large = path.join(dir, "large.ts") as FilePath;
    fs.writeFileSync(small, "ab");
    fs.writeFileSync(large, "abcdefgh");

    const sizes = await measure_file_sizes([small, large]);
    expect([...sizes]).toEqual([
      [small, 2],
      [large, 8],
    ]);
    expect(order_files([small, large], "descending_size", { file_sizes: sizes, seed: 1 })).toEqual([
      large,
      small,
    ]);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
