/**
 * The measured order-dependence this harness's determinism probe was validated
 * against.
 *
 * A determinism probe that reports "no difference" is worth exactly as much as
 * the demonstration that it can report a difference at all. This is that
 * demonstration, against a tree that really was order-dependent: ingesting the
 * same 8,494 files forward and then largest-first moved 31 entry points, 17,994
 * down to 17,973, and changed four of five recorded hashes while the node hash
 * stayed identical. That is what an order dependence looks like from the
 * outside — the set of functions is unchanged, and what the graph says about
 * them is not.
 *
 * The hashes are kept verbatim rather than remapped onto today's seven
 * components, because what makes this record worth anything is that it is what
 * was actually observed. They were produced by a different algorithm (SHA-1
 * over `join("|")`, first 16 hex) against a five-component fingerprint, so they
 * are a record of one run and never a value to compare a current digest with.
 */

interface RecordedHashPair {
  readonly forward: string;
  readonly descending_size: string;
  readonly changed: boolean;
}

export interface RecordedOrderSensitivity {
  /** The tree measured, named by the property that made the record worth taking. */
  readonly ariadne_tree: string;
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly file_count: number;
  readonly orders_compared: readonly string[];
  readonly entry_points_forward: number;
  readonly entry_points_descending_size: number;
  /**
   * Entry points whose MEMBERSHIP changed, counted in both directions — not the
   * net change in the total. The forward run reported 17,994 and the
   * largest-first run 17,973, a net 21 fewer, while 31 individual functions
   * entered or left the set: 26 left and 5 entered. Reading this as the net
   * delta makes the record look self-contradictory when it is not.
   */
  readonly entry_points_moved: number;
  /**
   * The five hash names that run recorded, under the algorithm it used. Not
   * comparable with a current component digest.
   */
  readonly recorded_hashes: Readonly<Record<string, RecordedHashPair>>;
  readonly note: string;
}

export const RECORDED_ORDER_SENSITIVITY: RecordedOrderSensitivity = {
  ariadne_tree:
    "a tree whose polymorphic expansion depended on the order files arrived in",
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  file_count: 8494,
  orders_compared: ["forward", "descending_size"],
  entry_points_forward: 17994,
  entry_points_descending_size: 17973,
  entry_points_moved: 31,
  recorded_hashes: {
    entry_points: {
      forward: "2871be58c0912b33",
      descending_size: "1a37eaf1fa981f39",
      changed: true,
    },
    call_references: {
      forward: "f9e8492f0cea5259",
      descending_size: "9d95928ba096f9dd",
      changed: true,
    },
    resolved_edges: {
      forward: "e5a73a35585a557a",
      descending_size: "4e9638caeebb87af",
      changed: true,
    },
    indirect_reachability: {
      forward: "ee8d2ebd22195046",
      descending_size: "da566426656b7501",
      changed: true,
    },
    nodes: {
      forward: "8d099b5bb8f8f9fa",
      descending_size: "8d099b5bb8f8f9fa",
      changed: false,
    },
  },
  note: "The moved entry points clustered on the exported-singleton idiom (ime.ts three times, inputMode.ts, tabFocus.ts, onboardingRegistry.ts, implicitActivationEvents.ts, textAreaEditContextRegistry.ts), which is why descending byte size is a required order: it reverses the arrival order of exactly those modules.",
};
