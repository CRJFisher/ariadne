/**
 * What the post-load grep index costs, measured when it stopped holding hits
 * past the point its one reader stops.
 *
 * `build_grep_index` maps every textual `name(` occurrence in the corpus to a
 * `GrepHit`, and `grep_for_calls` — the only thing that reads it — hands an
 * investigator at most `MAX_GREP_HITS` of them per name. Capping as the hits
 * arrive keeps that readable window intact and stops building the records
 * behind it. Retention is measured BY DELETION under forced GC — settle the
 * heap, drop the index, settle and read again — so the figure is bytes the
 * index actually holds rather than a sum of estimated object widths.
 *
 * The readable-window digest is what makes the two shapes comparable: a sha1
 * over `slice(0, 10)` of every name, taken in sorted name order. It is
 * byte-identical across all three arms, so the capped index exposes exactly the
 * evidence the uncapped one exposed, hit for hit — the discarded records were
 * unreachable, not merely unlikely to be read.
 *
 * `stoplist` is here so the cheaper-looking alternative is not re-proposed.
 * Dropping language keywords from the index removes a seventh of what it holds
 * but moves the digest, because `catch`, `new`, `for` and `typeof` are legal
 * TypeScript method names and `.catch()` is everywhere. Narrowing by count is
 * lossless where narrowing by keyword is not.
 */

/** One quantity under both index shapes, over one file set in one session. */
interface UncappedVersusCapped {
  /** Every occurrence in the corpus is stored. */
  readonly uncapped: number;
  /** Storage stops at `MAX_GREP_HITS` per name, as the hits arrive. */
  readonly capped: number;
}

/** One process: one checkout, one whole-corpus load, one index built. */
interface RecordedGrepIndexArm {
  readonly arm: "control" | "candidate";
  /** Position in the interleaved sequence, so the reader can see the A,B,A. */
  readonly sequence_index: number;
  readonly hits_retained: number;
  /** Bytes the index holds, freed when it alone is dropped between two settled reads. */
  readonly retained_mb: number;
  /** `build_grep_index` alone, cpu_user + cpu_system. */
  readonly index_build_cpu_ms: number;
  /** `load_project` over every discovered file — identical code in both arms. */
  readonly load_cpu_ms: number;
  /** Discovery, load, trace, index build and the digest, end to end. */
  readonly total_cpu_ms: number;
}

/**
 * The keyword stoplist, measured and refuted rather than argued about.
 */
interface RecordedStoplistRefutation {
  readonly keywords: readonly string[];
  /** Names the stoplist removes from the readable window. */
  readonly names_removed_from_window: number;
  /** Hits it removes from the readable window — evidence an investigator would have read. */
  readonly hits_removed_from_window: number;
  /** Hits the readable window holds in total, capped or not. */
  readonly window_hits: number;
  /** Hits it removes from the uncapped index, which is what makes it look attractive. */
  readonly hits_removed_from_uncapped_index: number;
  /** The readable-window digest under the stoplist. Not the one the arms agree on. */
  readonly digest: string;
  readonly verdict: string;
}

/**
 * The committed harness's own arms over the same corpus in the same session,
 * run so the identity claim rests on the instrument the epic is judged by
 * rather than on this row's private digest alone.
 */
interface RecordedIdentityArms {
  /** The seven components, identical under both shapes. */
  readonly fingerprint: Readonly<Record<string, string>>;
  readonly entry_points: number;
  /** The payload as emitted — membership and evidence-list order. Identical. */
  readonly diag_hash: string;
  /** The deep-sorted payload — membership alone. Identical. */
  readonly canonical_hash: string;
  /** Discovery, load and trace, cpu_user + cpu_system. */
  readonly whole_pipeline_cpu_ms: UncappedVersusCapped;
  /** `load_project` alone — identical code in both arms, so this is the session's drift. */
  readonly load_cpu_ms: UncappedVersusCapped;
  /** `extract_entry_point_diagnostics` over 17,563 entry points, wall. */
  readonly extraction_wall_ms: UncappedVersusCapped;
}

export interface RecordedGrepIndexCap {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly indexed_files: number;
  readonly dropped_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly ingest_order: string;
  /** Both arms run at one ceiling: the row makes no peak-RSS claim, only a retention one. */
  readonly heap_ceiling_mb: number;
  /**
   * The commit both shapes were measured over. The control arm is that commit
   * checked out; the candidate is that commit plus the cap.
   */
  readonly base_commit: string;
  /** Interleaved control, candidate, control. */
  readonly arms: readonly RecordedGrepIndexArm[];
  /** Names the index keys, identical under both shapes. */
  readonly distinct_names: number;
  /** sha1 over `slice(0, 10)` of every name, sorted. Identical in all three arms. */
  readonly readable_window_digest: string;
  readonly hits_retained: UncappedVersusCapped;
  readonly retained_mb: UncappedVersusCapped;
  /** The single name that dominates the uncapped index, and what it holds under each shape. */
  readonly largest_name: string;
  readonly largest_name_hits: UncappedVersusCapped;
  readonly identity_arms: RecordedIdentityArms;
  readonly stoplist: RecordedStoplistRefutation;
  /** What kind of change this is. Read it before quoting a CPU number off this row. */
  readonly verdict: string;
  readonly note: string;
}

export const RECORDED_GREP_INDEX_CAP: RecordedGrepIndexCap = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  indexed_files: 8494,
  dropped_files: 0,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  ingest_order: "forward",
  heap_ceiling_mb: 12288,
  base_commit: "743d963c",

  arms: [
    {
      arm: "control",
      sequence_index: 0,
      hits_retained: 1002037,
      retained_mb: 147.04,
      index_build_cpu_ms: 19287.4,
      load_cpu_ms: 350235.4,
      total_cpu_ms: 412474.1,
    },
    {
      arm: "candidate",
      sequence_index: 1,
      hits_retained: 178136,
      retained_mb: 36.4,
      index_build_cpu_ms: 18401.7,
      load_cpu_ms: 346444.3,
      total_cpu_ms: 406963.0,
    },
    {
      arm: "control",
      sequence_index: 2,
      hits_retained: 1002037,
      retained_mb: 147.04,
      index_build_cpu_ms: 19247.1,
      load_cpu_ms: 354004.6,
      total_cpu_ms: 415821.2,
    },
  ],

  distinct_names: 51882,
  readable_window_digest: "f64ffa9664e8b5db2723ec625fdce16aa7b03384",
  hits_retained: { uncapped: 1002037, capped: 178136 },
  retained_mb: { uncapped: 147.04, capped: 36.4 },
  largest_name: "if",
  largest_name_hits: { uncapped: 104285, capped: 10 },

  identity_arms: {
    fingerprint: {
      nodes: "201595/1dee6f73bd6b19b3",
      call_edges: "1077986/1ddc158820141bce",
      unresolved_calls: "420958/4783fb8da9030c81",
      raw_entry_points: "17563/81190da4a3cade3d",
      indirect_reachability_keys: "29378/bd658514f967310e",
      dropped_files: "0/e3b0c44298fc1c14",
      indirect_reachability_evidence: "29378/0d66eb1473576544",
    },
    entry_points: 17563,
    diag_hash: "d08f8e814597b4bb",
    canonical_hash: "834cc16d32aef077",
    whole_pipeline_cpu_ms: { uncapped: 364268.3, capped: 357068.6 },
    load_cpu_ms: { uncapped: 363742.7, capped: 356510.5 },
    extraction_wall_ms: { uncapped: 57161, capped: 57221 },
  },

  stoplist: {
    keywords: [
      "if", "for", "while", "switch", "catch", "return", "typeof", "new",
      "delete", "void", "await", "yield", "function", "import", "in", "is",
      "not", "and", "or", "assert", "del", "elif", "else", "except", "finally",
      "lambda", "raise", "try", "with", "match", "case", "do", "instanceof",
      "super", "throw",
    ],
    names_removed_from_window: 27,
    hits_removed_from_window: 249,
    window_hits: 178136,
    hits_removed_from_uncapped_index: 147194,
    digest: "65610217bd2a79ae7414858a75bedca38dc26023",
    verdict:
      "Refuted and not implemented. It reads as free because it removes 147,194 of the uncapped index's 1,002,037 hits, but the cap removes 823,901 — 146,945 of the stoplist's own among them — so what the stoplist adds on top is 249 hits under 27 names out of the 178,136 an investigator can read, and the readable-window digest moves. Its premise is false for TypeScript, where `catch`, `new`, `for` and `typeof` are all legal method names and `.catch()` is ubiquitous, so those 249 include real call sites. Narrowing by count is lossless; narrowing by keyword is not.",
  },

  verdict:
    "A MEMORY FIX, not a speedup. 110.6 MB of records nothing can reach are never built, 5.63x fewer hits retained and 4.04x fewer bytes, with the readable-window digest byte-identical across all three arms. CPU over the whole corpus does not move: the candidate's 406,963.0 ms sits 1.73% under a control mean of 414,147.65 ms, and the load phase — code identical in both arms — moves 1.61% of that on its own, so the run-level difference is session drift rather than the change. `build_grep_index` itself measures 18,401.7 ms against a control mean of 19,267.25, which is 866 ms, 0.21% of the run. Anyone quoting a speedup off this row is quoting noise.",

  note:
    "Three arms interleaved control,candidate,control, one process each, forward order, at --max-old-space-size=12288 with --expose-gc; both checkouts share one node_modules so both resolve the same grammars. " +
    "Retention is bytes freed when the index alone is dropped between two settled heap readings; the two control arms reproduce 147.04 MB and 1,002,037 hits to the last digit, so the spread on this measurement is zero and the candidate's 36.40 MB is not read against noise. " +
    "The pre-figure is this session's own, re-measured over the 8,494-file set TASK-381.8 readmits — 1,083,422 hits and 144.5 MB were taken over the 7,891 files the export gate used to leave behind, and are prior record rather than this row's control. " +
    "The capped index holds exactly the readable window: 178,136 hits under both shapes, and 51,882 distinct names under both. " +
    "`identity_arms` is a second pair of whole-corpus arms in the same session, run through `run_benchmark_arm` so the identity rests on the committed instrument: all seven fingerprint components agree, and so do both diagnostics hashes over 17,563 entry points — the emitted payload as well as the deep-sorted one. The extraction pass those arms time reads 57,161 ms against 57,221 ms of wall, 0.10% apart. " +
    "Hit counts, name counts, the fingerprint and the digests are properties of the corpus and travel between machines; the CPU and MB figures do not.",
};
