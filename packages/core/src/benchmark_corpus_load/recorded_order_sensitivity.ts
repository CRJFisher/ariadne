/**
 * The measured order-dependence this harness's determinism probe was validated
 * against.
 *
 * A determinism probe that reports "no difference" is worth exactly as much as
 * the demonstration that it can report a difference at all. This is that
 * demonstration, against a tree that really was order-dependent: on the
 * pre-TASK-381.11 tree, ingesting the same 8,494 files forward and then
 * largest-first moved 31 entry points, 17,994 down to 17,973, and changed four
 * of five recorded hashes while the node hash stayed identical. That is what an
 * order dependence looks like from the outside — the set of functions is
 * unchanged, and what the graph says about them is not.
 *
 * The values are kept verbatim rather than remapped onto today's seven
 * components, because what makes this record worth anything is that it is what
 * was actually observed. They were produced by a different algorithm (SHA-1
 * over `join("|")`, first 16 hex) against a five-component fingerprint, so they
 * cannot be recomputed here and must never be compared against a current
 * digest — `comparable_with_current_fingerprint` says so in the data rather
 * than in a comment someone can miss.
 */

export interface RecordedHashPair {
  readonly forward: string;
  readonly descending_size: string;
  readonly changed: boolean;
}

/**
 * The measured order-dependence the probe was validated against.
 *
 * The five hash names are the ones that run recorded. They are kept verbatim
 * rather than remapped onto today's seven components, because the value of
 * this record is that it is what was actually observed.
 */
export interface RecordedOrderSensitivity {
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
  readonly legacy_hashes: Readonly<Record<string, RecordedHashPair>>;
  /** Always false: a different algorithm over a different component set. */
  readonly comparable_with_current_fingerprint: false;
  readonly note: string;
}

export const RECORDED_ORDER_SENSITIVITY: RecordedOrderSensitivity = {
  ariadne_tree: "pre-TASK-381.11",
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  file_count: 8494,
  orders_compared: ["forward", "descending_size"],
  entry_points_forward: 17994,
  entry_points_descending_size: 17973,
  entry_points_moved: 31,
  comparable_with_current_fingerprint: false,
  legacy_hashes: {
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

