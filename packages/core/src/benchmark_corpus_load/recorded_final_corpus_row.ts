/**
 * The epic's closing row: every property the headline claim rests on, taken
 * together over every file of microsoft/vscode's `src/` on one tree, in one
 * session, one arm at a time.
 *
 * It states what a user can do — report entry points for 8,494 files — and the
 * four things that make the statement checkable: the same call graph under four
 * arrival orders, the CPU a cold load spends, the heap it needs, and a load that
 * survives being killed. Each is a mean over at least the runs the harness's
 * rules require, quoted with its ceiling, load and machine.
 *
 * Two things the row does NOT establish are recorded as such. The box was never
 * idle: its load average read 2.0 to 3.4 whenever none of this session's arms
 * was running, and 2.9 to 7.5 at arm starts, so every wall figure is contended and the
 * pooled wall is reported for what it is, never as a budget. And the interleaved
 * arms here are an A,B,A,B of one tree at two widths, not a control against
 * another tree, so no ratio to any earlier tree's figures is stated.
 *
 * The non-vacuity arms ran at ariadne@2bf8969f, where the four orders
 * did NOT agree; that disagreement is carried as the probe's non-vacuity on this
 * tree, and the commit after it is what made them agree.
 */

interface Digest {
  readonly count: number;
  readonly hash: string;
}

interface OrderArm {
  readonly ingest_order: string;
  readonly cpu_s: number;
  readonly wall_s: number;
  readonly peak_rss_mb: number;
  readonly loadavg_at_start: number;
  /** The diagnostics payload as emitted; differs by order. */
  readonly diag_hash: string;
  /** The same payload deep-sorted; one value across the orders. */
  readonly canonical_hash: string;
}

interface Spread {
  readonly observations: readonly number[];
  readonly mean: number;
  readonly cv_percent: number;
}

interface NonVacuityArm {
  readonly ingest_order: string;
  readonly call_edges: number;
  readonly raw_entry_points: number;
}

interface PooledArm {
  readonly cpu_s: number;
  readonly wall_s: number;
  readonly cpu_per_wall: number;
  readonly loadavg_at_start: number;
  readonly loadavg_at_end: number;
  readonly main_deserialize_s: number;
}

interface MemoryArm {
  /** The `--max-old-space-size` the process was started with. */
  readonly heap_flag_mb: number;
  readonly completed: boolean;
  /** CPU of the whole process up to its end, from `/usr/bin/time -l`, for an arm that died. */
  readonly process_cpu_s: number | null;
  /** The harness's load-and-trace CPU, for an arm that completed. */
  readonly cpu_s: number | null;
  readonly peak_rss_mb: number | null;
  readonly live_heap_mb: number | null;
}

export interface RecordedFinalCorpusRow {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly indexed_files: number;
  readonly dropped_files: number;
  /** The tree every arm below ran. */
  readonly ariadne_commit: string;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly memory_mb: number;
  readonly tree_sitter_version: string;
  readonly session_id: string;
  readonly seed: number;

  readonly agreed_components: Readonly<Record<string, Digest>>;
  readonly canonical_hash: string;
  readonly orders: readonly OrderArm[];
  readonly orders_heap_ceiling_mb: number;

  readonly non_vacuity_on_the_tree_before: {
    readonly ariadne_commit: string;
    readonly arms: readonly NonVacuityArm[];
    readonly cause: string;
  };

  /** Width one: the same dispatch code with one worker, which is this tree's serial load. */
  readonly serial_cpu_s: Spread & { readonly worker_width: 1 };
  readonly serial_cpu_per_wall: readonly number[];
  readonly serial_wall_s: readonly number[];
  readonly serial_loadavg_at_start: readonly number[];

  /** Judged on wall, which on this box is contended; see the header. */
  readonly pooled: {
    readonly worker_width: 5;
    readonly arms: readonly PooledArm[];
    readonly wall_s_mean: number;
    readonly cpu_s_mean: number;
    readonly measured_on_an_idle_box: false;
  };

  readonly memory: {
    readonly arms: readonly MemoryArm[];
    readonly died_at_the_default_ceiling: string;
    readonly completed_at_6144: {
      readonly peak_rss_mb_mean: number;
      readonly peak_rss_spread_percent: number;
      readonly live_heap_mb_mean: number;
      readonly fingerprint_identical_to_the_orders_row: boolean;
    };
  };

  readonly cache_resumption: {
    readonly files: number;
    readonly slice: string;
    readonly blobs_finished_at_kill: number;
    readonly blobs_reused_on_restart: number;
    readonly files_indexed_on_restart: number;
    readonly temporary_files_left: number;
    readonly components_identical_to_a_cold_load: boolean;
    readonly cold_load_components: Readonly<Record<string, Digest>>;
  };
}

export const RECORDED_FINAL_CORPUS_ROW: RecordedFinalCorpusRow = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  indexed_files: 8494,
  dropped_files: 0,
  ariadne_commit: "665a1d09",
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  memory_mb: 32768,
  tree_sitter_version: "0.25.0",
  session_id: "final-tip-1791147066",
  seed: 7,

  agreed_components: {
    nodes: { count: 202719, hash: "d7406d33df739d65" },
    call_edges: { count: 1550739, hash: "a616a4c29f85fca5" },
    unresolved_calls: { count: 356225, hash: "88f128485970dcf6" },
    raw_entry_points: { count: 11757, hash: "985dd5c57d5de80b" },
    indirect_reachability_keys: { count: 32087, hash: "821177633e1c122c" },
    dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
    indirect_reachability_evidence: { count: 32087, hash: "a5c3490733f42bfd" },
  },
  canonical_hash: "76462ec1aa241b99",
  orders: [
    {
      ingest_order: "forward",
      cpu_s: 479.08,
      wall_s: 208.52,
      peak_rss_mb: 7906.3,
      loadavg_at_start: 3.3,
      diag_hash: "56c3b0c471ec05a7",
      canonical_hash: "76462ec1aa241b99",
    },
    {
      ingest_order: "reversed",
      cpu_s: 480.18,
      wall_s: 199.54,
      peak_rss_mb: 9122.6,
      loadavg_at_start: 4.2,
      diag_hash: "2fffc2e452bf7b00",
      canonical_hash: "76462ec1aa241b99",
    },
    {
      ingest_order: "descending_size",
      cpu_s: 505.48,
      wall_s: 199.85,
      peak_rss_mb: 9733.6,
      loadavg_at_start: 4.6,
      diag_hash: "7796970a8df99c78",
      canonical_hash: "76462ec1aa241b99",
    },
    {
      ingest_order: "shuffled",
      cpu_s: 471.68,
      wall_s: 194.37,
      peak_rss_mb: 7324.9,
      loadavg_at_start: 4.2,
      diag_hash: "fff6951e3c21729f",
      canonical_hash: "76462ec1aa241b99",
    },
  ],
  orders_heap_ceiling_mb: 15522,

  non_vacuity_on_the_tree_before: {
    ariadne_commit: "2bf8969f",
    arms: [
      { ingest_order: "forward", call_edges: 1550682, raw_entry_points: 11759 },
      {
        ingest_order: "reversed",
        call_edges: 1550229,
        raw_entry_points: 11758,
      },
      {
        ingest_order: "descending_size",
        call_edges: 1550279,
        raw_entry_points: 11759,
      },
      {
        ingest_order: "shuffled",
        call_edges: 1550441,
        raw_entry_points: 11760,
      },
    ],
    cause:
      "A structural subtype inferred while calls resolve widened the closure of its parent and of every type above it after earlier files in the same pass had read the narrower one, so the calls that held the wider answer depended on the order files were resolved in. Nodes, unresolved calls, indirect reachability and the dropped set held still; call edges and raw entry points moved.",
  },

  serial_cpu_s: {
    worker_width: 1,
    observations: [415.87, 434.89, 418.73, 416.02, 419.48],
    mean: 421.0,
    cv_percent: 1.88,
  },
  serial_cpu_per_wall: [1.11, 1.04, 1.1, 1.13, 1.11],
  serial_wall_s: [373.55, 418.3, 380.97, 368.83, 378.24],
  serial_loadavg_at_start: [2.9, 4.1, 4.2, 7.5, 7.2],

  pooled: {
    worker_width: 5,
    arms: [
      {
        cpu_s: 471.08,
        wall_s: 202.02,
        cpu_per_wall: 2.33,
        loadavg_at_start: 3.8,
        loadavg_at_end: 15.7,
        main_deserialize_s: 30.4,
      },
      {
        cpu_s: 489.48,
        wall_s: 220.96,
        cpu_per_wall: 2.22,
        loadavg_at_start: 5.5,
        loadavg_at_end: 5.9,
        main_deserialize_s: 32.0,
      },
      {
        cpu_s: 477.6,
        wall_s: 206.69,
        cpu_per_wall: 2.31,
        loadavg_at_start: 3.3,
        loadavg_at_end: 6.5,
        main_deserialize_s: 30.0,
      },
      {
        cpu_s: 502.8,
        wall_s: 250.08,
        cpu_per_wall: 2.01,
        loadavg_at_start: 3.9,
        loadavg_at_end: 8.7,
        main_deserialize_s: 35.3,
      },
    ],
    wall_s_mean: 219.94,
    cpu_s_mean: 485.24,
    measured_on_an_idle_box: false,
  },

  memory: {
    arms: [
      {
        heap_flag_mb: 4144,
        completed: false,
        process_cpu_s: 483.1,
        cpu_s: null,
        peak_rss_mb: null,
        live_heap_mb: null,
      },
      {
        heap_flag_mb: 6144,
        completed: true,
        process_cpu_s: null,
        cpu_s: 432.01,
        peak_rss_mb: 5683.1,
        live_heap_mb: 3906.1,
      },
      {
        heap_flag_mb: 4144,
        completed: false,
        process_cpu_s: 495.81,
        cpu_s: null,
        peak_rss_mb: null,
        live_heap_mb: null,
      },
      {
        heap_flag_mb: 6144,
        completed: true,
        process_cpu_s: null,
        cpu_s: 433.01,
        peak_rss_mb: 5725.4,
        live_heap_mb: 3904.7,
      },
    ],
    died_at_the_default_ceiling:
      "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory, before the diagnostics pass starts; the last mark-compact of the first arm took 1,816 ms at mu 0.184 and freed 26.5 MB (4,078.6 to 4,052.1 MB)",
    completed_at_6144: {
      peak_rss_mb_mean: 5704.25,
      peak_rss_spread_percent: 0.74,
      live_heap_mb_mean: 3905.4,
      fingerprint_identical_to_the_orders_row: true,
    },
  },

  cache_resumption: {
    files: 200,
    slice:
      "folder-ts:src/vs/base, the first 200 path-sorted files, copied into a temporary directory",
    blobs_finished_at_kill: 101,
    blobs_reused_on_restart: 101,
    files_indexed_on_restart: 99,
    temporary_files_left: 0,
    components_identical_to_a_cold_load: true,
    cold_load_components: {
      nodes: { count: 5778, hash: "61888849a7477f16" },
      call_edges: { count: 13849, hash: "6f8cbf634e0d90f9" },
      unresolved_calls: { count: 6835, hash: "c990dbda540b36c2" },
      raw_entry_points: { count: 1325, hash: "62309d683f1e3fa9" },
      indirect_reachability_keys: { count: 1393, hash: "e70cbb6a4a9dfea3" },
      dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
      indirect_reachability_evidence: { count: 1393, hash: "4c755453ab355850" },
    },
  },
};
