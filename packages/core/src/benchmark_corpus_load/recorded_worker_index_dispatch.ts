/**
 * What indexing a corpus across worker threads buys, and what it costs.
 *
 * This is the one record in this module judged on WALL. Every other step in the
 * epic is judged on CPU because wall on a shared box measures scheduling; a
 * pool spends more CPU on purpose to finish sooner, so CPU alone would report a
 * successful parallelisation as a regression. The wall figures here are taken
 * on the least-loaded box this session could get — every arm carries its
 * loadavg and cpu/wall so a reader can judge them — and no CPU reduction is
 * claimed anywhere.
 *
 * The target is COMPUTED rather than fixed in advance. `parallelisable_share`
 * was measured on the tree immediately before any pool code existed, by
 * splitting one whole-corpus load at the seam a pool cuts at, and the wall
 * target is `serial_wall x (1 - share + share / 3.2)` with 3.2 the efficiency
 * the criterion names. The efficiency this box actually reached is recorded
 * beside it rather than substituted for it.
 *
 * Two findings the step was not written against are carried here rather than
 * dropped. The JSON transport nearly DOUBLED what the corpus retains, because
 * a built index shares each symbol id between the map that keys it, the
 * definition that carries it and every reference that names it, and `JSON.parse`
 * hands back a copy per occurrence. And a wider pool on a contended box was
 * FASTER in wall here, not slower — the opposite of the four-core prototype the
 * width rule was written against.
 */

/** One whole-corpus process: one checkout, one load, one trace. */
interface RecordedDispatchArm {
  readonly arm: string;
  readonly sequence_index: number;
  readonly ariadne_commit: string;
  readonly worker_width: number;
  readonly wall_s: number;
  readonly cpu_s: number;
  readonly cpu_per_wall: number;
  readonly peak_rss_mb: number;
  readonly loadavg_at_start: number;
  /** Summed worker-thread time inside parse-and-index, across all workers. */
  readonly worker_pass_s: number;
  /** Main-thread `deserialize_semantic_index`, which the pool cannot remove. */
  readonly main_deserialize_s: number;
}

/**
 * Where one whole-corpus load's CPU goes, split at the seam a pool cuts at.
 * `parse_and_index` is the parallelisable term; everything else reads
 * project-wide state and stays on one thread.
 */
interface RecordedPhaseSplit {
  readonly initialize_s: number;
  readonly read_s: number;
  readonly parse_and_index_s: number;
  readonly apply_to_registries_s: number;
  readonly resolve_corpus_s: number;
  readonly trace_call_graph_s: number;
}

/** Live heap after a forced collection, under one index transport. */
interface RecordedRetentionArm {
  readonly transport: "built directly" | "JSON" | "JSON, strings shared";
  readonly offered_files: number;
  readonly live_heap_mb: readonly number[];
}

/** One corpus size at which the pooled arms are asked whether they agree. */
interface RecordedFingerprintAgreement {
  readonly offered_files: number;
  readonly widths: readonly number[];
  readonly identical_to_serial: boolean;
}

/** A claim the step was written against that its own arms refute. */
interface RecordedCorrection {
  readonly claim: string;
  readonly measured: string;
}

export interface RecordedWorkerIndexDispatch {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly indexed_files: number;
  readonly dropped_files: number;
  readonly ingest_order: string;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly heap_ceiling_mb: number;
  /** The serial tree these arms are measured against. */
  readonly control_commit: string;
  /** The tree that dispatches pass A across workers. */
  readonly candidate_commit: string;

  /**
   * The share measurement, taken BEFORE any pool code was written, so the
   * target could not be fitted to the result.
   */
  readonly share_arm_commit: string;
  readonly share_arm_wall_s: number;
  readonly share_arm_cpu_s: number;
  readonly share_arm_phases: RecordedPhaseSplit;
  readonly parallelisable_share: number;

  /** The efficiency the criterion names, used to compute the target. */
  readonly target_efficiency: number;
  readonly serial_wall_s: number;
  readonly target_wall_s: number;
  readonly achieved_wall_s: number;
  /**
   * The efficiency this box actually reached, back-solved from the achieved
   * wall. Recorded beside the target's 3.2 rather than substituted for it.
   */
  readonly measured_efficiency: number;

  readonly arms: readonly RecordedDispatchArm[];
  readonly serial_cpu_s: number;
  readonly pooled_cpu_s: number;
  /** Pooled CPU over serial CPU. The criterion permits up to 1.35. */
  readonly cpu_ratio: number;
  readonly cpu_ratio_permitted: number;
  readonly wall_speedup: number;
  /** Main-thread deserialize over the pooled arm's whole wall. */
  readonly main_deserialize_share_of_wall: number;

  /** How the width rule reads on this box, and what it chose. */
  readonly width_rule: string;
  readonly width_on_this_box: readonly {
    readonly loadavg: number;
    readonly computed_width: number;
  }[];

  readonly retention: readonly RecordedRetentionArm[];
  /** Live heap over all 8,494 files, before and after the strings are shared. */
  readonly corpus_live_heap_mb_unshared: number;
  readonly corpus_live_heap_mb_shared: number;
  /** What the serial load retains, from `RECORDED_MEMORY_CONTRACT`'s session. */
  readonly serial_live_heap_mb: number;
  readonly memory_contract_at_6144: string;

  readonly fingerprint_agreement: readonly RecordedFingerprintAgreement[];
  /** The seven components, identical on every arm of every width. */
  readonly full_corpus_fingerprint: Readonly<Record<string, string>>;
  readonly diag_hash: string;
  readonly canonical_hash: string;

  readonly corrections: readonly RecordedCorrection[];
}

export const RECORDED_WORKER_INDEX_DISPATCH: RecordedWorkerIndexDispatch = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  indexed_files: 8494,
  dropped_files: 0,
  ingest_order: "forward",
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  heap_ceiling_mb: 12288,
  control_commit: "2b13f344",
  candidate_commit: "ecca77cd",

  share_arm_commit: "2b13f344",
  share_arm_wall_s: 217.88,
  share_arm_cpu_s: 227.41,
  share_arm_phases: {
    initialize_s: 0.34,
    read_s: 20.15,
    parse_and_index_s: 178.01,
    apply_to_registries_s: 5.45,
    resolve_corpus_s: 22.89,
    trace_call_graph_s: 0.54,
  },
  parallelisable_share: 0.7828,

  target_efficiency: 3.2,
  serial_wall_s: 212.19,
  target_wall_s: 97.99,
  achieved_wall_s: 79.65,
  measured_efficiency: 4.95,

  arms: [
    {
      arm: "serial",
      sequence_index: 0,
      ariadne_commit: "2b13f344",
      worker_width: 0,
      wall_s: 208.12,
      cpu_s: 222.94,
      cpu_per_wall: 1.07,
      peak_rss_mb: 8564.3,
      loadavg_at_start: 3.3,
      worker_pass_s: 0,
      main_deserialize_s: 0,
    },
    {
      arm: "pool-w5",
      sequence_index: 1,
      ariadne_commit: "ecca77cd",
      worker_width: 5,
      wall_s: 79.98,
      cpu_s: 277.08,
      cpu_per_wall: 3.46,
      peak_rss_mb: 8622.1,
      loadavg_at_start: 3.7,
      worker_pass_s: 200.39,
      main_deserialize_s: 25.1,
    },
    {
      arm: "serial",
      sequence_index: 2,
      ariadne_commit: "2b13f344",
      worker_width: 0,
      wall_s: 216.26,
      cpu_s: 230.35,
      cpu_per_wall: 1.07,
      peak_rss_mb: 8619.6,
      loadavg_at_start: 3.8,
      worker_pass_s: 0,
      main_deserialize_s: 0,
    },
    {
      arm: "pool-w5",
      sequence_index: 3,
      ariadne_commit: "ecca77cd",
      worker_width: 5,
      wall_s: 79.32,
      cpu_s: 276.18,
      cpu_per_wall: 3.48,
      peak_rss_mb: 6982.9,
      loadavg_at_start: 5.4,
      worker_pass_s: 201.07,
      main_deserialize_s: 24.69,
    },
    {
      arm: "pool-w1",
      sequence_index: 4,
      ariadne_commit: "ecca77cd",
      worker_width: 1,
      wall_s: 210.84,
      cpu_s: 252.93,
      cpu_per_wall: 1.2,
      peak_rss_mb: 6858.4,
      loadavg_at_start: 10.9,
      worker_pass_s: 179.9,
      main_deserialize_s: 22.16,
    },
    {
      arm: "contended-computed",
      sequence_index: 5,
      ariadne_commit: "ecca77cd",
      worker_width: 1,
      wall_s: 327.17,
      cpu_s: 274.86,
      cpu_per_wall: 0.84,
      peak_rss_mb: 6916.9,
      loadavg_at_start: 7.26,
      worker_pass_s: 276.41,
      main_deserialize_s: 23.66,
    },
    {
      arm: "contended-w5",
      sequence_index: 6,
      ariadne_commit: "ecca77cd",
      worker_width: 5,
      wall_s: 141.55,
      cpu_s: 281.78,
      cpu_per_wall: 1.99,
      peak_rss_mb: 7957.3,
      loadavg_at_start: 7.39,
      worker_pass_s: 405.71,
      main_deserialize_s: 38.62,
    },
  ],
  serial_cpu_s: 226.65,
  pooled_cpu_s: 276.63,
  cpu_ratio: 1.2206,
  cpu_ratio_permitted: 1.35,
  wall_speedup: 2.664,
  main_deserialize_share_of_wall: 0.3125,

  width_rule:
    "max(1, min(cpu_count - 1, floor(cpu_count - loadavg[0]))) — one core is always left for the main thread, which deserializes every result and resolves the corpus",
  width_on_this_box: [
    { loadavg: 3.0, computed_width: 3 },
    { loadavg: 4.6, computed_width: 1 },
    { loadavg: 7.26, computed_width: 1 },
  ],

  retention: [
    {
      transport: "built directly",
      offered_files: 1200,
      live_heap_mb: [507.1, 507.0],
    },
    { transport: "JSON", offered_files: 1200, live_heap_mb: [971.3, 971.2] },
    {
      transport: "JSON, strings shared",
      offered_files: 1200,
      live_heap_mb: [460.7, 460.6],
    },
  ],
  corpus_live_heap_mb_unshared: 7201.9,
  corpus_live_heap_mb_shared: 3240.2,
  serial_live_heap_mb: 4046.1,
  memory_contract_at_6144:
    "Unshared the pooled load DIED at the 6,144 MB ceiling the memory contract states as this corpus's floor, inside MessagePort::ReceiveMessage. Sharing the strings it completes there: 8,494 of 8,494, 17,563 entry points, 81.83 s of wall, 6,507.5 MB peak RSS, 3,240.4 MB live.",

  fingerprint_agreement: [
    { offered_files: 200, widths: [5, 1], identical_to_serial: true },
    { offered_files: 1200, widths: [5, 1], identical_to_serial: true },
    { offered_files: 8494, widths: [5, 1], identical_to_serial: true },
  ],
  full_corpus_fingerprint: {
    nodes: "201595/1dee6f73bd6b19b3",
    call_edges: "1077986/1ddc158820141bce",
    unresolved_calls: "420958/4783fb8da9030c81",
    raw_entry_points: "17563/81190da4a3cade3d",
    indirect_reachability_keys: "29378/bd658514f967310e",
    dropped_files: "0/e3b0c44298fc1c14",
    indirect_reachability_evidence: "29378/0d66eb1473576544",
  },
  diag_hash: "d08f8e814597b4bb",
  canonical_hash: "834cc16d32aef077",

  corrections: [
    {
      claim:
        "The JSON transport is free because the persistence cache already round-trips a SemanticIndex through it.",
      measured:
        "It nearly doubles what the corpus retains. A built index shares each symbol id between the map that keys it, the definition that carries it and every reference that names it, and each id embeds the file's absolute path; JSON.parse hands back a copy per occurrence. Over 1,200 files, 507.1 MB built directly against 971.3 MB round-tripped. Sharing the repeated strings on the way in takes it to 460.7 MB — BELOW the directly-built figure, because the table also collapses duplicates the built index never shared.",
    },
    {
      claim:
        "A JSON.parse reviver is the way to share those strings.",
      measured:
        "A reviver is called for every node in the document, numbers and locations included, and takes the parse off its fast path: 86.6 s of main-thread deserialize against 18.3 s unshared, which pushed the pooled wall from 83.2 to 132.9 s and gave the whole win back. Walking the parsed document reaches the same strings for 24.9 s.",
    },
    {
      claim:
        "On a contended box the pool is a net loss — at loadavg 7-19 on four cores every pool arm ran +21% wall and +24-31% CPU against serial.",
      measured:
        "It does not reproduce here. At loadavg 7.3 on six cores a width-five arm ran 141.55 s of wall against 327.17 s for the width-one arm the rule computes, at 281.78 s of CPU against 274.86 s — faster in wall and level in CPU. What it is doing is claiming six of twelve runnable threads instead of two of eight, which is taking a larger share of a box someone else is using rather than doing less work. The width rule is kept because that share is not this load's to take, and the criterion is met because the width it computes under contention IS one.",
    },
    {
      claim:
        "The pool's efficiency at full corpus is 3.2 on four cores.",
      measured:
        "4.95 back-solved from this box's achieved wall, on six cores at width five. The share measurement left the per-file READ on the main thread — 20.15 s of the serial arm's 227.41 s — and the worker reads its own file, so the pool moves more than the share names.",
    },
  ],
};
