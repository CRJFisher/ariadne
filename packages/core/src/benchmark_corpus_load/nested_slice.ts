/**
 * WHICH files an arm sees.
 *
 * Slices are nested by construction — every slice is a prefix of the
 * path-sorted discovery list — so a cost-per-file curve taken at n=50 and at
 * n=2,000 describes the same code growing rather than two unrelated corpora.
 * Nothing else about the selection matters; the prefix is the whole idea.
 */

import type { FilePath } from "@ariadnejs/types";

/**
 * The nested slice sizes. Each is a prefix of the one after it, and the full
 * corpus is the last step of the same chain.
 */
const NESTED_SLICE_SIZES: readonly number[] = [50, 100, 200, 1200, 2000];

/**
 * The slice of `size` files, taken as a prefix of the path-sorted discovery
 * list.
 */
export function nested_slice(
  path_sorted_files: readonly FilePath[],
  size: number,
): FilePath[] {
  if (size <= 0) {
    throw new Error(`Slice size must be positive, got ${size}`);
  }
  if (size > path_sorted_files.length) {
    // Clamping would run a different file set than the one asked for under the
    // name of the one asked for — the same reason `plan_nested_slices` drops an
    // over-large size rather than folding it onto the full corpus.
    throw new Error(
      `A slice of ${size} files was asked for, but the corpus holds ${path_sorted_files.length}. ` +
        "Ask for a slice the corpus can supply, or use the full corpus.",
    );
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
