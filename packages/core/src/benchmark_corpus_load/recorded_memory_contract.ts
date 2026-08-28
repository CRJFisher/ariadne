/**
 * What a corpus load needs from the heap, measured as a bracket rather than
 * stated as a guess.
 *
 * A user who types `ariadne` at a repository of vscode's scale either gets an
 * entry-point report or gets a fatal V8 error after several minutes of CPU, and
 * which one they get is decided by a flag they have no reason to know exists.
 * This record is the measurement that answers it: the default ceiling does not
 * suffice, `--max-old-space-size=6144` does, and the answer either way is the
 * same call graph.
 *
 * Three things here are what a later memory projection would otherwise get
 * wrong. The live heap — read after a forced collection — is the same to a
 * tenth of a megabyte at both ceilings that complete, and it sits 97.9 MB
 * BELOW node's default ceiling, so the failure is a mark-compact working set
 * and not retained data. The closing `used_heap_size` is only that live figure
 * when the ceiling forces a full collection: at 6,144 MB two processes agree to
 * 0.01% and at 12,288 MB they spread 24.84%. And peak RSS is a function of the
 * ceiling the collector schedules against rather than of what the load retains,
 * so the RSS-to-live-heap ratio is recorded as a pair — 1.43x and 1.70x over
 * one identical live set — and never as a constant.
 *
 * The requirement is documentation, not code. Setting the flag from inside
 * Ariadne needs a re-exec or a `NODE_OPTIONS` hand-off — a second execution
 * path — and would cover the CLI while leaving the MCP server and the library
 * consumer with neither the flag nor the guarantee.
 */

interface RecordedSpread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  readonly spread_percent: number;
  readonly cv_percent: number;
  readonly observations: readonly number[];
}

/**
 * One line of `--trace-gc`, kept because the shape of the death is the finding.
 * A collection that runs for seconds and frees single-digit megabytes at a
 * mutator utilisation of 0.018 is a process that has stopped doing work, which
 * a wall-clock figure alone would report as "still running".
 */
interface GarbageCollection {
  readonly at_ms: number;
  readonly heap_before_mb: number;
  readonly heap_after_mb: number;
  /** V8's own view of the committed heap after the collection. */
  readonly committed_after_mb: number;
  readonly duration_ms: number;
  readonly average_mutator_utilisation: number;
  readonly current_mutator_utilisation: number;
}

interface FailedArm {
  readonly heap_flag_mb: null;
  readonly heap_cap_mb: number;
  readonly completed: false;
  readonly fatal_error: string;
  /** CPU spent before the process died, from `/usr/bin/time -l` on the arm. */
  readonly cpu_seconds: number;
  readonly wall_seconds: number;
  /**
   * The last reading the arm's own heartbeat emitted before the collector took
   * the process over. The gap between it and the death is the thrash.
   */
  readonly last_progress: {
    readonly wall_seconds: number;
    readonly cpu_seconds: number;
    readonly rss_mb: number;
    readonly used_heap_mb: number;
  };
  readonly final_collections: readonly GarbageCollection[];
  /**
   * The load never finished, so no file count, no fingerprint and no trace
   * phase exist for this arm. Recorded as false rather than omitted: an absent
   * fingerprint is the result.
   */
  readonly reached_trace_phase: false;
}

interface CompletedArm {
  readonly heap_flag_mb: number;
  /** What V8 reports as `heap_size_limit`, which is the flag plus its own headroom. */
  readonly heap_cap_mb: number;
  readonly completed: true;
  readonly sequence_indices: readonly number[];
  readonly indexed: number;
  readonly dropped: number;
  readonly cpu_seconds: RecordedSpread;
  readonly wall_seconds: readonly number[];
  readonly cpu_per_wall: readonly number[];
  readonly loadavg_at_arm_start: readonly number[];
  readonly peak_rss_mb: RecordedSpread;
  /**
   * The closing `used_heap_size`, which is what the GC schedule last left
   * behind. It equals the live set only where the ceiling forces a full
   * collection, and the two rows here are what proves that.
   */
  readonly settled_heap_mb: RecordedSpread;
}

interface RatioAtCeiling {
  readonly heap_cap_mb: number;
  readonly peak_rss_mb: number;
  readonly live_heap_mb: number;
  readonly ratio: number;
}

interface FingerprintDigest {
  readonly count: number;
  readonly hash: string;
}

interface OtherCorpusRow {
  readonly predicate: string;
  readonly discovered_files: number;
  readonly indexed: number;
  readonly dropped: number;
  readonly heap_flag_mb: number;
  readonly heap_cap_mb: number;
  readonly cpu_seconds: RecordedSpread;
  readonly peak_rss_mb: RecordedSpread;
  readonly live_heap_mb: RecordedSpread;
  /** Why the `src/` floor is not carried over to this file set. */
  readonly verdict: string;
}

export interface RecordedMemoryContract {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly tree_sitter_version: string;
  readonly tree_sitter_typescript_version: string;
  readonly ariadne_commit: string;
  readonly session_id: string;

  /** V8's `heap_size_limit` on this machine with no flag on the command line. */
  readonly default_old_space_ceiling_mb: number;
  /** The measured floor: the smallest ceiling on record that completes. */
  readonly required_old_space_mb: number;
  /** The requirement as a user reads it, corpus named, because it is corpus-bound. */
  readonly requirement: string;

  readonly at_default_ceiling: FailedArm;
  readonly completing: readonly CompletedArm[];
  /**
   * The smaller ceiling's CPU over the larger one's, from arms interleaved
   * A,B,A,B in one session. Collecting more often is not free, and a cost
   * stated from a doc's number instead of a same-session control was wrong by
   * 40% once already.
   */
  readonly cost_of_the_smaller_ceiling: number;

  /**
   * What the load retains, read after a forced collection in every arm that
   * had one. This is the figure the default ceiling must hold, and the
   * follow-up task is written against it.
   */
  readonly live_heap_mb: RecordedSpread;
  readonly live_heap_headroom_below_default_ceiling_mb: number;
  readonly rss_to_live_heap: readonly RatioAtCeiling[];

  /**
   * The ceiling changes the collector's schedule and nothing else: every arm
   * reports the same call graph, and it is the digest `RECORDED_ORDER_INDEPENDENCE`
   * pinned for this tree.
   */
  readonly fingerprint_at_every_ceiling: {
    readonly components: Readonly<Record<string, FingerprintDigest>>;
    readonly canonical_hash: string;
    readonly diag_hash: string;
    readonly arms_agreeing: number;
  };

  readonly other_corpus: OtherCorpusRow;

  /**
   * The audit behind "Ariadne sets no heap flag": what was searched and what
   * was found, so the claim is checkable rather than asserted.
   */
  readonly no_heap_flag_in_ariadne: {
    readonly searched: readonly string[];
    readonly matches_in_shipped_code: number;
    readonly matches_in_the_harness: readonly string[];
    readonly why: string;
  };

  /**
   * Figures measured elsewhere, kept because they are the numbers this task was
   * written against and a reader will otherwise re-derive them as current. They
   * are not comparands for the rows above: absolute CPU and peak RSS are
   * properties of the box.
   */
  readonly recorded_elsewhere: readonly {
    readonly claim: string;
    readonly reason: string;
  }[];
}

const AGREED_FINGERPRINT: Readonly<Record<string, FingerprintDigest>> = {
  nodes: { count: 201595, hash: "1dee6f73bd6b19b3" },
  call_edges: { count: 1077986, hash: "1ddc158820141bce" },
  unresolved_calls: { count: 420958, hash: "4783fb8da9030c81" },
  raw_entry_points: { count: 17563, hash: "81190da4a3cade3d" },
  indirect_reachability_keys: { count: 29378, hash: "bd658514f967310e" },
  dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
  indirect_reachability_evidence: { count: 29378, hash: "0d66eb1473576544" },
};

export const RECORDED_MEMORY_CONTRACT: RecordedMemoryContract = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  total_memory_mb: 32768,
  tree_sitter_version: "0.25.0",
  tree_sitter_typescript_version: "0.23.2",
  ariadne_commit: "417de2fc",
  session_id: "task-381.16",

  default_old_space_ceiling_mb: 4144,
  required_old_space_mb: 6144,
  requirement:
    "Reporting entry points for microsoft/vscode at f3fa55c3 over its `src/` tree — 8,494 files under Ariadne's discovery walk — requires node to be started with `--max-old-space-size` of at least 6144. " +
    "Node's default ceiling on this machine is 4,144 MB and the load dies there. The flag belongs on the command line of whatever runs Ariadne; Ariadne sets no heap flag itself.",

  at_default_ceiling: {
    heap_flag_mb: null,
    heap_cap_mb: 4144,
    completed: false,
    fatal_error:
      "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
    cpu_seconds: 444.3,
    wall_seconds: 372.6,
    last_progress: {
      wall_seconds: 301,
      cpu_seconds: 308,
      rss_mb: 3790.5,
      used_heap_mb: 3035.9,
    },
    // The last six collections: 71 seconds of wall spent recovering 9 to 53 MB
    // a time while the mutator ran 1.8% of the time. Nothing here is a
    // slow-down; it is a process that has stopped indexing.
    final_collections: [
      {
        at_ms: 362446,
        heap_before_mb: 4018.8,
        heap_after_mb: 3965.5,
        committed_after_mb: 4088.9,
        duration_ms: 1236.1,
        average_mutator_utilisation: 0.337,
        current_mutator_utilisation: 0.175,
      },
      {
        at_ms: 364917,
        heap_before_mb: 3996.9,
        heap_after_mb: 3979.3,
        committed_after_mb: 4115.7,
        duration_ms: 1335.26,
        average_mutator_utilisation: 0.406,
        current_mutator_utilisation: 0.46,
      },
      {
        at_ms: 366563,
        heap_before_mb: 4009.6,
        heap_after_mb: 3993.5,
        committed_after_mb: 4129.9,
        duration_ms: 1570.18,
        average_mutator_utilisation: 0.252,
        current_mutator_utilisation: 0.046,
      },
      {
        at_ms: 368418,
        heap_before_mb: 4009.3,
        heap_after_mb: 4000.2,
        committed_after_mb: 4135.9,
        duration_ms: 1804.79,
        average_mutator_utilisation: 0.142,
        current_mutator_utilisation: 0.027,
      },
      {
        at_ms: 370079,
        heap_before_mb: 4016.8,
        heap_after_mb: 4006.9,
        committed_after_mb: 4142.7,
        duration_ms: 1608.62,
        average_mutator_utilisation: 0.09,
        current_mutator_utilisation: 0.032,
      },
      {
        at_ms: 372379,
        heap_before_mb: 4022.6,
        heap_after_mb: 4014.0,
        committed_after_mb: 4150.0,
        duration_ms: 2259.28,
        average_mutator_utilisation: 0.049,
        current_mutator_utilisation: 0.018,
      },
    ],
    reached_trace_phase: false,
  },

  completing: [
    {
      heap_flag_mb: 6144,
      heap_cap_mb: 6192,
      completed: true,
      sequence_indices: [1, 3],
      indexed: 8494,
      dropped: 0,
      cpu_seconds: {
        mean: 356.22,
        min: 355.1,
        max: 357.34,
        spread_percent: 0.63,
        cv_percent: 0.31,
        observations: [355.1, 357.34],
      },
      wall_seconds: [360.2, 342.1],
      cpu_per_wall: [0.99, 1.04],
      loadavg_at_arm_start: [2.5, 4.8],
      peak_rss_mb: {
        mean: 5803.45,
        min: 5762.2,
        max: 5844.7,
        spread_percent: 1.42,
        cv_percent: 0.71,
        observations: [5762.2, 5844.7],
      },
      settled_heap_mb: {
        mean: 5155.25,
        min: 5155.1,
        max: 5155.4,
        spread_percent: 0.01,
        cv_percent: 0.0,
        observations: [5155.1, 5155.4],
      },
    },
    {
      heap_flag_mb: 12288,
      heap_cap_mb: 12336,
      completed: true,
      sequence_indices: [2, 4],
      indexed: 8494,
      dropped: 0,
      cpu_seconds: {
        mean: 349.37,
        min: 347.61,
        max: 351.12,
        spread_percent: 1.0,
        cv_percent: 0.5,
        observations: [347.61, 351.12],
      },
      wall_seconds: [334.3, 339.6],
      cpu_per_wall: [1.04, 1.03],
      loadavg_at_arm_start: [5.4, 4.3],
      peak_rss_mb: {
        mean: 6880.9,
        min: 6703.8,
        max: 7058.0,
        spread_percent: 5.15,
        cv_percent: 2.57,
        observations: [7058.0, 6703.8],
      },
      settled_heap_mb: {
        mean: 6385.6,
        min: 5592.4,
        max: 7178.8,
        spread_percent: 24.84,
        cv_percent: 12.42,
        observations: [5592.4, 7178.8],
      },
    },
  ],
  cost_of_the_smaller_ceiling: 1.02,

  live_heap_mb: {
    mean: 4046.1,
    min: 4045.9,
    max: 4046.2,
    spread_percent: 0.01,
    cv_percent: 0.0,
    observations: [4046.2, 4046.2, 4045.9],
  },
  live_heap_headroom_below_default_ceiling_mb: 97.9,

  // One live set, two peaks. The collector schedules against the ceiling it is
  // given, so resident memory follows the flag and not the corpus, and a
  // projection made from heap alone is wrong by whatever the flag was.
  rss_to_live_heap: [
    { heap_cap_mb: 6192, peak_rss_mb: 5803.45, live_heap_mb: 4046.1, ratio: 1.43 },
    { heap_cap_mb: 12336, peak_rss_mb: 6880.9, live_heap_mb: 4046.1, ratio: 1.7 },
  ],

  fingerprint_at_every_ceiling: {
    components: AGREED_FINGERPRINT,
    canonical_hash: "834cc16d32aef077",
    diag_hash: "d08f8e814597b4bb",
    arms_agreeing: 4,
  },

  other_corpus: {
    predicate: "repository-root",
    discovered_files: 12654,
    indexed: 12653,
    dropped: 1,
    heap_flag_mb: 22645,
    heap_cap_mb: 22693,
    cpu_seconds: {
      mean: 1151.69,
      min: 1149.48,
      max: 1153.89,
      spread_percent: 0.38,
      cv_percent: 0.19,
      observations: [1149.48, 1153.89],
    },
    peak_rss_mb: {
      mean: 8540.05,
      min: 8326.6,
      max: 8753.5,
      spread_percent: 5.0,
      cv_percent: 2.5,
      observations: [8753.5, 8326.6],
    },
    live_heap_mb: {
      mean: 5562.95,
      min: 5562.8,
      max: 5563.1,
      spread_percent: 0.01,
      cv_percent: 0.0,
      observations: [5562.8, 5563.1],
    },
    verdict:
      "The 6,144 MB floor is stated for `src/` and is NOT known to be sufficient here. This file set retains 5,562.95 MB, which would leave 581 MB of collector working set under a 6,144 MB ceiling, and `src/` died with 97.9 MB. Both arms ran at 22,645 MB; the floor for this corpus is unmeasured. The one file dropped here is the scope-tree invariant of TASK-387, not a memory effect: both arms index 12,653 of 12,654 and report one identical fingerprint.",
  },

  no_heap_flag_in_ariadne: {
    searched: [
      "--max-old-space-size",
      "max_old_space",
      "NODE_OPTIONS",
      "process.execPath",
      "child_process spawn/exec/fork",
    ],
    matches_in_shipped_code: 0,
    matches_in_the_harness: [
      "packages/core/scripts/run_load_benchmark.ts sizes each arm's child process from `required_heap_mb`",
      "packages/core/src/benchmark_corpus_load/benchmark_corpus_load.ts refuses an arm the heap cannot hold and names the flag to re-run with",
    ],
    why: "Setting the ceiling from inside Ariadne needs a re-exec or a NODE_OPTIONS hand-off, which is a second execution path, and it would cover the CLI while leaving the MCP server and the library consumer with neither the flag nor the guarantee.",
  },

  recorded_elsewhere: [
    {
      claim:
        "The corpus OOMs after 666 s of CPU with `Ineffective mark-compacts near heap limit`, its last GC at 4,047.7 of 4,133.9 MB, one mark-compact of 6,178 ms recovering 0.4 MB at mu 0.005, over a live heap that settles at 3,563.8 MB.",
      reason:
        "Measured on a 4-core Darwin 21.6.0 box under node v22.23.2. The verdict reproduces here and the figures do not: 444.3 s of CPU, `Reached heap limit Allocation failed`, a final mark-compact of 2,259 ms at mu 0.018, and a live heap of 4,046.1 MB — above the ceiling rather than 580 MB below it.",
    },
    {
      claim:
        "`--max-old-space-size=6144` completes in 474,838.4 ms of CPU (+2.6% against the 12 GB runs) at 4,172.0 MB peak RSS, and the composed stack completes at 507.0 s and 5,367.4 MB.",
      reason:
        "Same 4-core box. The verdict reproduces — 6,144 MB completes with a byte-identical fingerprint — and the absolutes do not: 356.22 s of CPU as a mean of two processes, +1.96% against an interleaved 12,288 MB control, at 5,803.45 MB peak RSS as a mean of two.",
    },
    {
      claim:
        "The RSS-to-settled-heap ratio was 2.3x before the export-gate repair (7.83 GB resident against 3.32 GB settled) and 1.17x after (4,172.0 against 3,563.8 MB), because the native tree-sitter arenas that inflated it were being fed by 603 files that were indexed and then discarded.",
      reason:
        "That pair is a 4-core box's, and the export-gate repair is measured on this box to cost no memory at all: 6,911.75 MB candidate against 6,914.1 MB control, -0.03%, in `RECORDED_EXPORT_DECLARATION_SPACE`. The ratio still moves here, and what moves it is the ceiling: 1.43x at 6,192 MB against 1.70x at 12,336 MB over one identical live set.",
    },
    {
      claim:
        "Peak RSS varies up to 26% run to run on identical inputs while settled heap is stable to 0.01%.",
      reason:
        "Both halves hold with a correction to the second. Peak RSS spreads 1.42% and 5.15% here and 61% on the in-repo corpus, so a single-run RSS figure is still not a measurement. The settled heap is stable to 0.01% only where the ceiling forces a full collection — 5,155.1 and 5,155.4 MB at 6,144 MB against 5,592.4 and 7,178.8 MB at 12,288 MB, a 24.84% spread over one live set.",
    },
  ],
};
