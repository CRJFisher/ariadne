/**
 * The file sets and arrival orders a benchmark arm ingests.
 *
 * Two independent knobs. A slice fixes WHICH files an arm sees, and slices are
 * nested by construction — every slice is a prefix of the path-sorted
 * discovery list — so a cost-per-file curve taken at n=50 and at n=2,000
 * describes the same code growing rather than two unrelated corpora. An order
 * fixes the sequence those files arrive in, and the same slice run in four
 * orders is how the call graph is shown to be a function of the codebase
 * rather than of the walk.
 *
 * Descending byte size is one of the four and is not optional. It scrambles
 * directory locality and reverses the arrival order of the large
 * exported-singleton modules, and it was the order that moved 31 entry points
 * (17,994 -> 17,973) on a tree where forward against reverse moved 35 — a
 * regression that plain reversal alone under-reports.
 */

import * as fs from "fs/promises";
import type { FilePath } from "@ariadnejs/types";

export type IngestOrder =
  | "forward"
  | "reversed"
  | "descending_size"
  | "shuffled";

/** Every order a multi-order run covers. */
export const INGEST_ORDERS: readonly IngestOrder[] = [
  "forward",
  "reversed",
  "descending_size",
  "shuffled",
];

/**
 * The nested slice sizes. Each is a prefix of the one after it, and the full
 * corpus is the last step of the same chain.
 */
const NESTED_SLICE_SIZES: readonly number[] = [50, 100, 200, 1200, 2000];

/**
 * The slice of `size` files, taken as a prefix of the path-sorted discovery
 * list. Prefixes are what makes the slices nested; nothing else about the
 * selection matters.
 */
export function nested_slice(
  path_sorted_files: readonly FilePath[],
  size: number,
): FilePath[] {
  if (size <= 0) {
    throw new Error(`Slice size must be positive, got ${size}`);
  }
  return path_sorted_files.slice(0, size);
}

/**
 * The slice sizes this corpus can actually supply, plus the full corpus.
 *
 * A slice larger than the corpus is dropped rather than silently clamped: two
 * clamped slices would be the same file set under two different names, and a
 * cost-per-file curve drawn through them would show flat growth that never
 * happened.
 */
export function plan_nested_slices(
  path_sorted_files: readonly FilePath[],
): number[] {
  if (path_sorted_files.length === 0) {
    throw new Error(
      "An empty corpus has no slices to plan — check the corpus root and predicate before running arms.",
    );
  }
  const sizes = NESTED_SLICE_SIZES.filter(
    (size) => size < path_sorted_files.length,
  );
  return [...sizes, path_sorted_files.length];
}

/**
 * The mulberry32 generator, so a shuffled order is reproducible from the seed
 * recorded on the row.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OrderFilesOptions {
  /**
   * Byte size per file. Required for `descending_size` and ignored by the
   * other orders, so a caller that never asks for that order can pass an empty
   * map instead of stat-ing the corpus.
   */
  readonly file_sizes: ReadonlyMap<FilePath, number>;
  /** The mulberry32 seed. Recorded on the row for every order, not just shuffled. */
  readonly seed: number;
}

/**
 * Read the byte size of every file, for `descending_size`.
 */
export async function measure_file_sizes(
  files: readonly FilePath[],
): Promise<ReadonlyMap<FilePath, number>> {
  const sizes = new Map<FilePath, number>();
  for (const file of files) {
    const stats = await fs.stat(file);
    sizes.set(file, stats.size);
  }
  return sizes;
}

export function order_files(
  files: readonly FilePath[],
  order: IngestOrder,
  options: OrderFilesOptions,
): FilePath[] {
  switch (order) {
    case "forward":
      return [...files];
    case "reversed":
      return [...files].reverse();
    case "descending_size":
      return order_by_descending_size(files, options.file_sizes);
    case "shuffled":
      return shuffle(files, options.seed);
  }
}

/**
 * Largest file first, ties broken by ascending path so the order is a function
 * of the corpus and not of the sort's stability.
 */
function order_by_descending_size(
  files: readonly FilePath[],
  file_sizes: ReadonlyMap<FilePath, number>,
): FilePath[] {
  const missing = files.filter((file) => !file_sizes.has(file));
  if (missing.length > 0) {
    throw new Error(
      `descending_size needs a byte size for every file; ${missing.length} missing, first ${missing[0]}`,
    );
  }
  return [...files].sort((left, right) => {
    const size_difference =
      (file_sizes.get(right) ?? 0) - (file_sizes.get(left) ?? 0);
    if (size_difference !== 0) return size_difference;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function shuffle(files: readonly FilePath[], seed: number): FilePath[] {
  const shuffled = [...files];
  const random = mulberry32(seed);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    const held = shuffled[index];
    shuffled[index] = shuffled[swap];
    shuffled[swap] = held;
  }
  return shuffled;
}
