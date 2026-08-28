/**
 * What the per-scope name table costs, measured when it stopped carrying a copy
 * of every visible binding in every scope and became a parent chain.
 *
 * A flattened table opens each scope with a copy of everything its ancestors
 * bound, so a name visible at file scope is stored again in every descendant
 * that can see it. A chain stores each name once, at the scope that binds it,
 * and a lookup that misses walks the parent link. Retention is measured BY
 * DELETION under forced GC — settle the heap, drop the table, settle and read
 * again — so the figure is bytes the table actually holds rather than a sum of
 * estimated slot widths.
 *
 * The visible (scope, name) pair count is what makes the two shapes
 * comparable. It is every name a lookup in a scope can see, summed over scopes,
 * and it is identical under both shapes at every slice. The chain therefore
 * exposes exactly the name set the flat table materialised, name for name — a
 * structural equivalence, not a sampled one, and stronger than the fingerprint
 * agreement beside it because it does not depend on any name being reached.
 *
 * `INTERNING_CEILING` is here so the cheaper-looking alternative is not
 * re-proposed. Rewriting every retained string slot to the canonical instance
 * of its content — the ceiling of any interning scheme, measured by doing it —
 * freed 5.42 KB/file against a 68 KB/file estimate. V8 already shares those
 * strings; the estimate counted pointer slots as copies.
 */

/** One quantity under both table shapes, over one file set in one session. */
interface FlattenedVersusChained {
  /** Each scope holds a copy of every binding visible in an ancestor. */
  readonly flattened: number;
  /** Each scope holds only what it binds, plus a link to its parent. */
  readonly chained: number;
}

interface RecordedNameTableSlice {
  /** Files the slice offered — a path-ordered prefix of the discovery walk. */
  readonly offered_files: number;
  readonly indexed: number;
  readonly dropped: number;
  /** Independent processes per arm, interleaved control,candidate. */
  readonly reps_per_arm: number;
  /** Retained name-table KB per indexed file, measured by deletion. */
  readonly name_table_kb_per_file: FlattenedVersusChained;
  /** Entries the table stores, counted once per distinct link. */
  readonly stored_entries: FlattenedVersusChained;
  /**
   * Names a lookup in a scope can see, summed over scopes. Identical under both
   * shapes, which is the equivalence proof.
   */
  readonly visible_scope_name_pairs: number;
  readonly scopes: number;
  /** Distinct links the scopes collapse to: a scope binding nothing shares its parent's. */
  readonly chain_links: number;
  readonly mean_chain_depth: number;
  readonly max_chain_depth: number;
  /** Whole-project settled heap per indexed file, post-GC. */
  readonly settled_heap_kb_per_file: FlattenedVersusChained;
  /** Load plus trace, cpu_user + cpu_system, mean over the arm's reps. */
  readonly cpu_total_ms: FlattenedVersusChained;
  readonly cpu_cv_percent: FlattenedVersusChained;
  /** Each of the seven components as `count/hash`, identical under both shapes. */
  readonly fingerprint: Readonly<Record<string, string>>;
}

/**
 * The measured ceiling of interning, taken by rewriting every retained string
 * slot to the canonical instance of its content and re-settling the heap.
 */
interface RecordedInterningCeiling {
  /** What the plan estimated interning would free, before it was measured. */
  readonly estimated_kb_per_file: number;
  /** What rewriting every slot actually freed. */
  readonly measured_kb_per_file: number;
  readonly slots_rewritten: number;
  readonly bytes_freed: number;
  /** Per string class, all within GC noise of each other on a ~500 KB/file baseline. */
  readonly by_class_kb_per_file: Readonly<Record<string, number>>;
  /** CPU the rewriting pass itself cost, against ~63 ms/file of total load. */
  readonly pass_cost_ms_per_file: string;
  readonly verdict: string;
}

export interface RecordedNameTableMemory {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  /** Files the walk found; each slice below is a prefix of this set. */
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly ingest_order: string;
  /**
   * The commit both shapes were measured over. The control arm is that commit
   * checked out; the candidate is that commit plus the chain.
   */
  readonly base_commit: string;
  readonly slices: readonly RecordedNameTableSlice[];
  readonly interning_ceiling: RecordedInterningCeiling;
  readonly note: string;
}

export const RECORDED_NAME_TABLE_MEMORY: RecordedNameTableMemory = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  ingest_order: "forward",
  base_commit: "bbbe3290",

  slices: [
    {
      offered_files: 200,
      indexed: 187,
      dropped: 13,
      reps_per_arm: 3,
      name_table_kb_per_file: { flattened: 171.86, chained: 10.84 },
      stored_entries: { flattened: 819226, chained: 19235 },
      visible_scope_name_pairs: 819226,
      scopes: 11229,
      chain_links: 5751,
      mean_chain_depth: 2.96,
      max_chain_depth: 8,
      settled_heap_kb_per_file: { flattened: 718.9, chained: 556.1 },
      cpu_total_ms: { flattened: 10178.5, chained: 10193.5 },
      cpu_cv_percent: { flattened: 0.3, chained: 0.67 },
      fingerprint: {
        nodes: "4647/ad14f2293f197b20",
        call_edges: "4836/3b9df93fbce5059c",
        unresolved_calls: "8840/a1ebcd53f4dc2af9",
        raw_entry_points: "1552/69759567d4cf1a2a",
        indirect_reachability_keys: "919/cc12e7d54f05663f",
        dropped_files: "13/08ea282f1850d164",
        indirect_reachability_evidence: "919/766157f8f5b51b32",
      },
    },
    {
      offered_files: 400,
      indexed: 377,
      dropped: 23,
      reps_per_arm: 2,
      name_table_kb_per_file: { flattened: 112.03, chained: 9.99 },
      stored_entries: { flattened: 1064644, chained: 33435 },
      visible_scope_name_pairs: 1064644,
      scopes: 19177,
      chain_links: 10890,
      mean_chain_depth: 3.11,
      max_chain_depth: 9,
      settled_heap_kb_per_file: { flattened: 578.8, chained: 475.9 },
      cpu_total_ms: { flattened: 17661.4, chained: 17343.3 },
      cpu_cv_percent: { flattened: 0.57, chained: 0.06 },
      fingerprint: {
        nodes: "8945/8aed703206878996",
        call_edges: "11332/b850dd4faae61ba2",
        unresolved_calls: "24318/788a8fdc91e6bf0d",
        raw_entry_points: "1774/e05b3708c38eac2e",
        indirect_reachability_keys: "1678/fef663ca538ed51d",
        dropped_files: "23/13a95f0146c51ddf",
        indirect_reachability_evidence: "1678/45ef5ee19a08d723",
      },
    },
    {
      offered_files: 800,
      indexed: 766,
      dropped: 34,
      reps_per_arm: 2,
      name_table_kb_per_file: { flattened: 113.73, chained: 10.02 },
      stored_entries: { flattened: 2153280, chained: 71341 },
      visible_scope_name_pairs: 2153280,
      scopes: 36910,
      chain_links: 21916,
      mean_chain_depth: 3.19,
      max_chain_depth: 12,
      settled_heap_kb_per_file: { flattened: 564.5, chained: 460.6 },
      cpu_total_ms: { flattened: 32865.6, chained: 32606.2 },
      cpu_cv_percent: { flattened: 0.23, chained: 0.34 },
      fingerprint: {
        nodes: "17387/7822b913ca031a9b",
        call_edges: "24268/ade0eba10dbc93b0",
        unresolved_calls: "46764/8d2ea97e7aadb091",
        raw_entry_points: "3237/a63cc989e1681939",
        indirect_reachability_keys: "2811/afb93fcd156684a5",
        dropped_files: "34/f7387f1b9c7b96ff",
        indirect_reachability_evidence: "2811/e5a1b263736dd934",
      },
    },
  ],

  interning_ceiling: {
    estimated_kb_per_file: 68,
    measured_kb_per_file: 5.42,
    slots_rewritten: 1455167,
    bytes_freed: 999136,
    by_class_kb_per_file: {
      identifier: 9.13,
      file_path: 3.57,
      symbol_id: 3.56,
    },
    pass_cost_ms_per_file: "4.1-4.6 against ~63 total, so ~7% of load CPU",
    verdict:
      "Refuted by 12x and not implemented. The per-class figures sum ABOVE the whole, which is the signature of GC noise on a ~500 KB/file baseline: V8 already shares these strings, and the large occurrence counts are pointer slots rather than copies. This is the ceiling of any interning scheme, measured by performing the rewrite outright, so a creation-site implementation cannot beat it — and that one would additionally have to touch 211 `node.text` sites across every language leaf. The path interning that does pay is inside cache blobs, where storing a file's path once instead of in every reference record measures 1.694x on the bytes: a different mechanism on different data, recorded in RECORDED_CACHE_RESUMPTION.",
  },

  note:
    "Both shapes run over the base commit in the same session on one machine, interleaved control,candidate per rep, forward order, one process per arm at --max-old-space-size=6144 with --expose-gc. " +
    "Retention is bytes freed when the table alone is dropped between two settled heap readings, taken in a function that holds no reference to it; the census is stable to within 0.01% across reps. " +
    "The stored-entry, scope, link and visible-pair counts are properties of the algorithm and travel between machines; the CPU and KB/file figures do not. " +
    "The seven fingerprint components are identical under the two shapes at every slice, and the 200-file row reproduces the value RECORDED_RESOLUTION_EVICTION_COST holds for the same slice, so both arms describe the call graph the tree already committed to. " +
    "The 800-file slice's 10.02 KB/file sits marginally above the 10 KB/file the prototype measured its way to on a tree that indexed 737 files where this one indexes 766: the flattened arm's own baseline moved with it, 80.21 to 113.73, and the ratio the change buys is 11.4x either way.",
};
