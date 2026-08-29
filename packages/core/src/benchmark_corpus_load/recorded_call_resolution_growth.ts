/**
 * What call resolution costs as a corpus grows, and what the growth is made of.
 *
 * `resolve_calls_for_files` is the term this epic's remaining scaling risk was
 * stated against. The row below measures it three ways over vscode's `src/`:
 * the shape of the scan each resolve pass performs, the term's CPU at three
 * corpus sizes, and — from a `--cpu-prof` run at each size — what inside the
 * term is growing.
 *
 * The answer has two halves, and they point in opposite directions.
 *
 * Indexing anonymous callables by file makes the callback pass read the batch's
 * own callbacks instead of the project's whole callable set. That is a scan
 * shape, not a budget: a single-file resolve inside the loaded corpus reads
 * **8** callables where it read **212,275**, and visits 8 registry entries
 * where it walked 916,801. On the file-watcher path that is 1.78x off the pass.
 * At cold load it is worth nothing measurable, because the two-phase driver
 * already collapsed the pass count to one — and one scan of the project is one
 * scan of the batch when the batch IS the project. The profiler puts the scan
 * the pass was paying for at 16.3 ms of a 353 s run.
 *
 * What does grow is polymorphic dispatch, and it grows because its answer does.
 * Unresolved call sites — the input — rise linearly with the corpus (exponent
 * 1.013). Resolved call edges rise at 1.310, subtype edges enumerated at 1.726,
 * and the CPU inside `resolve_polymorphic_method` and
 * `resolve_polymorphic_class_method` at 1.881, taking that family from 5.6% of
 * the term at 927 files to 22.9% at 8,494. The mean number of subtypes
 * enumerated per expansion goes 4.64 → 6.09 → 16.77: a wider corpus is one in
 * which an interface genuinely has more implementations, so the work of naming
 * every possible runtime target is the work of producing a bigger answer. No
 * index removes it.
 *
 * `scaling_limit` states where that leaves the term, and `superseded` keeps the
 * figures this row replaces rather than dropping them.
 */

/** Repeated observations of one quantity, summarized the way the harness does. */
interface RecordedSpread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  /** Coefficient of variation, as a percentage. */
  readonly cv_percent: number;
  readonly observations: readonly number[];
}

/** One full-corpus process: one checkout, one whole-corpus load, one term timed. */
interface RecordedGrowthArm {
  readonly arm: "control" | "candidate";
  /** Position in the interleaved sequence, so the reader can see the A,B,A,B. */
  readonly sequence_index: number;
  /** Discovery, load and trace, cpu_user + cpu_system. */
  readonly run_cpu_s: number;
  /**
   * `resolve_calls_for_files` alone: a `process.cpuUsage()` delta taken across
   * the call by a wrapper installed on `ResolutionRegistry`'s prototype from
   * outside, so no production file is touched. It CONTAINS
   * `resolve_callback_invocations`, which is module-local and cannot be wrapped.
   */
  readonly term_cpu_ms: number;
  readonly peak_rss_mb: number;
  readonly cpu_per_wall: number;
  readonly loadavg_at_start: number;
}

/** What one resolve pass reads out of the definition registry to find callbacks. */
interface RecordedScanShape {
  /** Files in the project when the pass ran. */
  readonly project_files: number;
  /** Files the pass was given. */
  readonly batch_files: number;
  /** Callables the pass was handed back. */
  readonly callables_read: number;
  /** Registry entries the walk behind them visited. */
  readonly registry_entries_visited: number;
}

/** One corpus size on the growth curve, measured on the control build. */
interface RecordedGrowthPoint {
  readonly files: number;
  readonly term_cpu_ms: RecordedSpread;
  /** `term_cpu_ms.mean / files`. */
  readonly cpu_per_file_ms: number;
  /** The run the term is a share of. */
  readonly run_cpu_s: number;
  readonly share_percent: number;
}

/**
 * The term's own decomposition, sampled under `--cpu-prof` at one corpus size.
 *
 * Subtree time, not self time: each figure is the frame plus everything it
 * called. `resolve_callback_invocations` and the polymorphic pair run INSIDE
 * `resolve_calls_for_files`, so their figures are parts of its figure and are
 * never added to it. The profiler samples wall, so these are proportions of one
 * profiled run rather than CPU budgets — the CPU budget is `arms`.
 */
interface RecordedTermSplit {
  readonly files: number;
  readonly build: "control" | "candidate";
  readonly resolve_calls_for_files_ms: number;
  readonly resolve_calls_ms: number;
  readonly resolve_method_call_ms: number;
  /** `resolve_polymorphic_method` + `resolve_polymorphic_class_method`. */
  readonly polymorphic_dispatch_ms: number;
  readonly get_transitive_subtypes_ms: number;
  readonly resolve_callback_invocations_ms: number;
  /**
   * The project-wide callable scan, summed over every caller in the run: one
   * per resolve pass, one in `trace_call_graph`, one in diagnostics extraction.
   * The index removes the resolve pass's, so the difference between the builds
   * at 8,494 files — 49.4 ms against 33.1 — is what one whole-corpus pass was
   * paying for it.
   */
  readonly get_callable_definitions_ms: number;
  /** The indexed read that replaces the pass's share of it. */
  readonly get_anonymous_callables_in_file_ms: number | null;
}

/**
 * What the subtype walk enumerated over one whole-corpus resolve pass, counted
 * by wrapping `DefinitionRegistry.get_subtypes` and `get_member_index` from
 * outside. These are properties of the corpus and travel between machines; the
 * CPU figures beside them do not.
 */
interface RecordedDispatchEnumeration {
  readonly files: number;
  /** Types the transitive-subtype walk stepped through. */
  readonly subtype_walk_steps: number;
  /** Subtype edges the walk enumerated. */
  readonly subtype_edges_enumerated: number;
  /** Polymorphic expansions: one `get_member_index` per expansion. */
  readonly expansions: number;
  /** `subtype_edges_enumerated / expansions` — the fan-out of one dispatch. */
  readonly edges_per_expansion: number;
  readonly resolved_call_edges: number;
  readonly unresolved_call_sites: number;
}

/** A quantity's growth exponent against the file count, over a measured pair. */
interface RecordedExponent {
  readonly quantity: string;
  readonly from_files: number;
  readonly to_files: number;
  readonly ratio: number;
  /** `ln(ratio) / ln(file ratio)`. 1.0 is linear. */
  readonly exponent: number;
}

/**
 * Where the measured exponents put the term, stated as sizes rather than as a
 * verdict — and read against the memory contract, which arrives first.
 */
interface RecordedScalingLimit {
  readonly exponent_used: number;
  readonly basis: string;
  readonly reaches_10_percent_of_the_run_at_files: number;
  readonly reaches_25_percent_of_the_run_at_files: number;
  /** Where the term costs as much as everything else in the run put together. */
  readonly becomes_dominant_at_files: number;
}

/**
 * One resolve pass over a fixed batch — a single file re-resolved through
 * `Project.update_file` — with the project grown around it. This is the shape
 * the file watcher drives, and the shape the scan's cost was first measured in.
 */
interface RecordedIncrementalEdit {
  readonly build: "control" | "candidate";
  readonly project_files: number;
  /** `Project.update_file` on one file, end to end. Null where only the term was timed. */
  readonly update_file_cpu_ms: RecordedSpread | null;
  /** `resolve_calls_for_files` inside it. */
  readonly term_cpu_ms: RecordedSpread;
  readonly scan: RecordedScanShape;
}

/** One corpus size at which both builds reported the same call graph. */
interface RecordedIdenticalFingerprint {
  readonly files: number;
  /** Each of the seven components as `count/hash`, identical in both builds. */
  readonly components: Readonly<Record<string, string>>;
  /** The payload as emitted — membership and evidence-list order. */
  readonly diag_hash: string;
  /** The deep-sorted payload — membership alone. */
  readonly canonical_hash: string;
}

/** A figure that is kept rather than deleted, with what replaced it and why. */
interface RecordedSupersession {
  readonly claim: string;
  readonly reason: string;
  readonly outcome: string;
}

export interface RecordedCallResolutionGrowth {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly indexed_files: number;
  readonly dropped_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly heap_cap_mb: number;
  readonly ingest_order: string;
  /** Shared by every arm below, which is what makes the comparison admissible. */
  readonly session_id: string;
  /** The tree the control arms measure: the epic's stack through TASK-381.12. */
  readonly control_commit: string;
  /** The tree the candidate arms measure. */
  readonly candidate_tree: string;
  readonly arms: readonly RecordedGrowthArm[];
  readonly control_term: RecordedSpread;
  readonly candidate_term: RecordedSpread;
  readonly control_run_cpu_s: RecordedSpread;
  readonly candidate_run_cpu_s: RecordedSpread;
  /** Candidate minus control. Negative is a saving. */
  readonly term_cpu_delta_ms: number;
  readonly term_share_delta_percentage_points: number;
  readonly growth_curve: readonly RecordedGrowthPoint[];
  /** Least-squares slope of ln(term CPU) on ln(files) over `growth_curve`. */
  readonly term_exponent_least_squares: number;
  readonly term_exponent_pairwise: Readonly<Record<string, number>>;
  readonly term_split: readonly RecordedTermSplit[];
  readonly dispatch_enumeration: readonly RecordedDispatchEnumeration[];
  readonly mechanism_exponents: readonly RecordedExponent[];
  readonly scaling_limit: readonly RecordedScalingLimit[];
  readonly memory_wall: string;
  readonly cold_pass_scan: readonly (RecordedScanShape & {
    readonly build: "control" | "candidate";
  })[];
  readonly incremental_edit: readonly RecordedIncrementalEdit[];
  /** How the single-sample rows in `incremental_edit` are to be read. */
  readonly incremental_edit_note: string;
  readonly identical_fingerprints: readonly RecordedIdenticalFingerprint[];
  readonly superseded: readonly RecordedSupersession[];
  readonly verdict: string;
  readonly note: string;
}

export const RECORDED_CALL_RESOLUTION_GROWTH: RecordedCallResolutionGrowth = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  indexed_files: 8494,
  dropped_files: 0,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  total_memory_mb: 32768,
  heap_cap_mb: 12336,
  ingest_order: "forward",
  session_id: "task-381.15",
  control_commit: "3da741d7",
  candidate_tree:
    "3da741d7 plus the TASK-381.15 working tree — the by-file anonymous-callable index in registries/definition.ts and the batch-keyed callback pass in call_resolution/call_resolver.ts",

  arms: [
    {
      arm: "control",
      sequence_index: 10,
      run_cpu_s: 357.76,
      term_cpu_ms: 19105.1,
      peak_rss_mb: 7355.1,
      cpu_per_wall: 1.08,
      loadavg_at_start: 4.5,
    },
    {
      arm: "candidate",
      sequence_index: 11,
      run_cpu_s: 348.3,
      term_cpu_ms: 14244.7,
      peak_rss_mb: 6977.8,
      cpu_per_wall: 1.05,
      loadavg_at_start: 4.6,
    },
    {
      arm: "control",
      sequence_index: 12,
      run_cpu_s: 356.52,
      term_cpu_ms: 19645.3,
      peak_rss_mb: 6609.3,
      cpu_per_wall: 1.07,
      loadavg_at_start: 4.8,
    },
    {
      arm: "candidate",
      sequence_index: 13,
      run_cpu_s: 358.47,
      term_cpu_ms: 19955.4,
      peak_rss_mb: 7136.5,
      cpu_per_wall: 1.07,
      loadavg_at_start: 6.5,
    },
    {
      arm: "control",
      sequence_index: 16,
      run_cpu_s: 359.0,
      term_cpu_ms: 19846.0,
      peak_rss_mb: 7222.8,
      cpu_per_wall: 1.06,
      loadavg_at_start: 3.4,
    },
    {
      arm: "candidate",
      sequence_index: 17,
      run_cpu_s: 359.66,
      term_cpu_ms: 19071.2,
      peak_rss_mb: 7410.2,
      cpu_per_wall: 1.07,
      loadavg_at_start: 5.4,
    },
    {
      arm: "control",
      sequence_index: 20,
      run_cpu_s: 340.15,
      term_cpu_ms: 14104.7,
      peak_rss_mb: 6744.7,
      cpu_per_wall: 1.04,
      loadavg_at_start: 4.2,
    },
    {
      arm: "candidate",
      sequence_index: 21,
      run_cpu_s: 356.09,
      term_cpu_ms: 19881.1,
      peak_rss_mb: 7616.5,
      cpu_per_wall: 1.07,
      loadavg_at_start: 4.3,
    },
  ],

  control_term: {
    mean: 18175.3,
    min: 14104.7,
    max: 19846.0,
    cv_percent: 13.02,
    observations: [19105.1, 19645.3, 19846.0, 14104.7],
  },
  candidate_term: {
    mean: 18288.1,
    min: 14244.7,
    max: 19955.4,
    cv_percent: 12.9,
    observations: [14244.7, 19955.4, 19071.2, 19881.1],
  },
  control_run_cpu_s: {
    mean: 353.36,
    min: 340.15,
    max: 359.0,
    cv_percent: 2.17,
    observations: [357.76, 356.52, 359.0, 340.15],
  },
  candidate_run_cpu_s: {
    mean: 355.63,
    min: 348.3,
    max: 359.66,
    cv_percent: 1.24,
    observations: [348.3, 358.47, 359.66, 356.09],
  },
  term_cpu_delta_ms: 112.8,
  term_share_delta_percentage_points: -0.001,

  growth_curve: [
    {
      files: 927,
      term_cpu_ms: {
        mean: 1665.9,
        min: 1228.4,
        max: 1897.5,
        cv_percent: 18.58,
        observations: [1871.9, 1228.4, 1897.5],
      },
      cpu_per_file_ms: 1.7971,
      run_cpu_s: 36.4,
      share_percent: 4.58,
    },
    {
      files: 2000,
      term_cpu_ms: {
        mean: 2059.6,
        min: 2027.1,
        max: 2092.1,
        cv_percent: 1.58,
        observations: [2027.1, 2092.1],
      },
      cpu_per_file_ms: 1.0298,
      run_cpu_s: 66.3,
      share_percent: 3.11,
    },
    {
      files: 8494,
      term_cpu_ms: {
        mean: 18175.3,
        min: 14104.7,
        max: 19846.0,
        cv_percent: 13.02,
        observations: [19105.1, 19645.3, 19846.0, 14104.7],
      },
      cpu_per_file_ms: 2.1398,
      run_cpu_s: 353.36,
      share_percent: 5.14,
    },
  ],

  term_exponent_least_squares: 1.134,
  term_exponent_pairwise: {
    "927_to_2000": 0.276,
    "2000_to_8494": 1.506,
    "927_to_8494": 1.079,
  },

  term_split: [
    {
      files: 927,
      build: "control",
      resolve_calls_for_files_ms: 773.3,
      resolve_calls_ms: 302.6,
      resolve_method_call_ms: 223.8,
      polymorphic_dispatch_ms: 43.3,
      get_transitive_subtypes_ms: 18.7,
      resolve_callback_invocations_ms: 138.1,
      get_callable_definitions_ms: 7.1,
      get_anonymous_callables_in_file_ms: null,
    },
    {
      files: 2000,
      build: "control",
      resolve_calls_for_files_ms: 1520.3,
      resolve_calls_ms: 558.4,
      resolve_method_call_ms: 433.9,
      polymorphic_dispatch_ms: 95.5,
      get_transitive_subtypes_ms: 49.4,
      resolve_callback_invocations_ms: 337.8,
      get_callable_definitions_ms: 11.9,
      get_anonymous_callables_in_file_ms: null,
    },
    {
      files: 8494,
      build: "control",
      resolve_calls_for_files_ms: 12201.8,
      resolve_calls_ms: 5533.6,
      resolve_method_call_ms: 4905.6,
      polymorphic_dispatch_ms: 2793.5,
      get_transitive_subtypes_ms: 1403.1,
      resolve_callback_invocations_ms: 2572.3,
      get_callable_definitions_ms: 49.4,
      get_anonymous_callables_in_file_ms: null,
    },
    {
      files: 8494,
      build: "candidate",
      resolve_calls_for_files_ms: 12067.6,
      resolve_calls_ms: 5604.1,
      resolve_method_call_ms: 5018.6,
      polymorphic_dispatch_ms: 2776.9,
      get_transitive_subtypes_ms: 1367.9,
      resolve_callback_invocations_ms: 2359.1,
      get_callable_definitions_ms: 33.1,
      get_anonymous_callables_in_file_ms: 1.5,
    },
  ],

  dispatch_enumeration: [
    {
      files: 927,
      subtype_walk_steps: 175041,
      subtype_edges_enumerated: 120828,
      expansions: 26019,
      edges_per_expansion: 4.64,
      resolved_call_edges: 59244,
      unresolved_call_sites: 44654,
    },
    {
      files: 2000,
      subtype_walk_steps: 392543,
      subtype_edges_enumerated: 299400,
      expansions: 49180,
      edges_per_expansion: 6.09,
      resolved_call_edges: 123294,
      unresolved_call_sites: 84854,
    },
    {
      files: 8494,
      subtype_walk_steps: 5910062,
      subtype_edges_enumerated: 5532388,
      expansions: 329857,
      edges_per_expansion: 16.77,
      resolved_call_edges: 1077986,
      unresolved_call_sites: 420958,
    },
  ],

  mechanism_exponents: [
    {
      quantity: "unresolved call sites — the term's input",
      from_files: 927,
      to_files: 8494,
      ratio: 9.43,
      exponent: 1.013,
    },
    {
      quantity: "polymorphic expansions",
      from_files: 927,
      to_files: 8494,
      ratio: 12.68,
      exponent: 1.147,
    },
    {
      quantity: "resolved call edges — the term's output",
      from_files: 927,
      to_files: 8494,
      ratio: 18.2,
      exponent: 1.31,
    },
    {
      quantity: "subtype walk steps",
      from_files: 927,
      to_files: 8494,
      ratio: 33.76,
      exponent: 1.589,
    },
    {
      quantity: "subtype edges enumerated",
      from_files: 927,
      to_files: 8494,
      ratio: 45.79,
      exponent: 1.726,
    },
    {
      quantity: "CPU inside polymorphic dispatch",
      from_files: 927,
      to_files: 8494,
      ratio: 64.51,
      exponent: 1.881,
    },
  ],

  scaling_limit: [
    {
      exponent_used: 1.506,
      basis:
        "the term's own CPU between the two largest measured sizes, 2,000 and 8,494 files",
      reaches_10_percent_of_the_run_at_files: 35062,
      reaches_25_percent_of_the_run_at_files: 307444,
      becomes_dominant_at_files: 2695835,
    },
    {
      exponent_used: 1.881,
      basis:
        "the polymorphic-dispatch family's CPU between 927 and 8,494 files — the fastest-growing term measured",
      reaches_10_percent_of_the_run_at_files: 19176,
      reaches_25_percent_of_the_run_at_files: 66730,
      becomes_dominant_at_files: 232214,
    },
  ],

  memory_wall:
    "The share figures above are what a corpus that size would cost if it could be loaded, and it cannot. `RECORDED_MEMORY_CONTRACT` measures a 4,046.1 MB live heap over these 8,494 files at a required 6,144 MB ceiling. Retention is per-file, so 19,176 files needs about 9.1 GB live and 232,214 needs about 111 GB. Call resolution reaching 10% of the run is the first of these a machine can actually see; dominance sits far past the point the load stops finishing at all.",

  cold_pass_scan: [
    {
      build: "control",
      project_files: 1200,
      batch_files: 1200,
      callables_read: 29800,
      registry_entries_visited: 128710,
    },
    {
      build: "control",
      project_files: 8494,
      batch_files: 8494,
      callables_read: 212275,
      registry_entries_visited: 916801,
    },
    {
      build: "candidate",
      project_files: 1200,
      batch_files: 1200,
      callables_read: 12269,
      registry_entries_visited: 12269,
    },
    {
      build: "candidate",
      project_files: 8494,
      batch_files: 8494,
      callables_read: 109781,
      registry_entries_visited: 109781,
    },
  ],

  incremental_edit: [
    {
      build: "control",
      project_files: 8494,
      update_file_cpu_ms: {
        mean: 854.5,
        min: 833.2,
        max: 892.6,
        cv_percent: 2.34,
        observations: [848.3, 892.6, 850.6, 847.8, 833.2],
      },
      term_cpu_ms: {
        mean: 132.7,
        min: 119.6,
        max: 150.6,
        cv_percent: 8.68,
        observations: [136.8, 150.6, 119.6, 120.7, 135.9],
      },
      scan: {
        project_files: 8494,
        batch_files: 1,
        callables_read: 212275,
        registry_entries_visited: 916801,
      },
    },
    {
      build: "candidate",
      project_files: 8494,
      update_file_cpu_ms: {
        mean: 796.7,
        min: 769.4,
        max: 826.4,
        cv_percent: 2.57,
        observations: [812.4, 782.4, 769.4, 793.1, 826.4],
      },
      term_cpu_ms: {
        mean: 74.5,
        min: 66.3,
        max: 87.1,
        cv_percent: 9.3,
        observations: [66.3, 74.6, 70.9, 73.6, 87.1],
      },
      scan: {
        project_files: 8494,
        batch_files: 1,
        callables_read: 8,
        registry_entries_visited: 8,
      },
    },
    {
      build: "control",
      project_files: 1200,
      update_file_cpu_ms: null,
      term_cpu_ms: {
        mean: 21.8,
        min: 21.8,
        max: 21.8,
        cv_percent: 0,
        observations: [21.8],
      },
      scan: {
        project_files: 1200,
        batch_files: 1,
        callables_read: 29800,
        registry_entries_visited: 128710,
      },
    },
    {
      build: "candidate",
      project_files: 1200,
      update_file_cpu_ms: null,
      term_cpu_ms: {
        mean: 47.5,
        min: 47.5,
        max: 47.5,
        cv_percent: 0,
        observations: [47.5],
      },
      scan: {
        project_files: 1200,
        batch_files: 1,
        callables_read: 8,
        registry_entries_visited: 8,
      },
    },
  ],

  incremental_edit_note:
    "The 1,200-file pair is ONE observation each and its CPU ordering is the reverse of the 8,494-file pair's: 21.8 ms control against 47.5 ms candidate, on a term that spreads 8-9% over five reps at corpus scale and is measured here immediately after a cold load. Nothing about a 25 ms difference between two single samples is a measurement, and it is kept rather than dropped because the counts beside it are the point: 29,800 callables read against 8, at a project size where the control's scan is already 7.1x smaller than it is at 8,494 files. The 8,494-file pair is five reps per arm and is where the CPU claim is made.",

  identical_fingerprints: [
    {
      files: 200,
      components: {
        nodes: "5845/1ad79c154f97a44f",
        call_edges: "9800/f879c029f3d27cac",
        unresolved_calls: "8825/414c494d25fc354b",
        raw_entry_points: "1837/24003d52bbd8058c",
        indirect_reachability_keys: "1282/7c7cbc295a5059a8",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "1282/1ac199d6b1bffdd7",
      },
      diag_hash: "3f9c07a2892dd058",
      canonical_hash: "f7bf99f2afb43b18",
    },
    {
      files: 1200,
      components: {
        nodes: "28057/d0a70789f48a4e2f",
        call_edges: "84346/b32e61fb8179dbcc",
        unresolved_calls: "62942/6cb76597cbe63c25",
        raw_entry_points: "4141/50307354dde86797",
        indirect_reachability_keys: "4450/7c25d1cf1ffc8c32",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "4450/4540f71f3ad37723",
      },
      diag_hash: "0571819adcc4b15a",
      canonical_hash: "b89fb63905853697",
    },
    {
      files: 8494,
      components: {
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
    },
  ],

  superseded: [
    {
      claim:
        "`resolve_calls_for_files` costs 45 s (5.72%) and `resolve_callback_invocations` 37 s (4.71%) of a 778 s run — 82 s and 10.4% together.",
      reason:
        "Those figures describe the tree before TASK-381.8, on a box where identical computation measured 777.6 s, 801.3 s and 1,019.4 s in three sessions. Absolute CPU does not transfer between sessions, and the driver underneath the term changed.",
      outcome:
        "SUPERSEDED and not this row's baseline. Measured on the post-TASK-381.8 build in this session, the term is 18,175.3 ms — 5.14% of a 353.36 s run, mean of four interleaved processes.",
    },
    {
      claim:
        "An independent fit put the growth exponent of the term at 1.83, and the two terms together would fall by >= 15 s of CPU and >= 3 percentage points of share once the callable scan was indexed.",
      reason:
        "The 15 s target is larger than four fifths of the whole term as it now measures, and the scan it was aimed at costs 16.3 ms of a 353 s run — 49.4 ms across the three calls a control run makes, 33.1 ms of which survive in the candidate because `trace_call_graph` and diagnostics extraction call the same method. The two-phase driver of TASK-381.4 had already collapsed the pass count from one-per-file to one, and a single scan of the project is a single scan of the batch when the batch is the project. Nothing that could be indexed away is worth 15 s here.",
      outcome:
        "NOT MET and unreachable on this tree. Candidate 18,288.1 ms against control 18,175.3 ms — +112.8 ms and -0.001 percentage points, four processes per arm interleaved in one session, both arms' spread 13%. The exponent measured on the post-381.8 build is 1.134 by least squares over 927 / 2,000 / 8,494 files, not 1.83.",
    },
    {
      claim:
        "The callback pass scans 552,079 callables across 199 calls at 200 files.",
      reason:
        "That is the per-arrival driver's shape — 199 calls for 200 files. The two-phase driver makes a cold load one call, so the count per pass and the count per load are no longer the same measurement.",
      outcome:
        "SUPERSEDED by two readings that name their pass shape. A whole-corpus cold pass reads 212,275 callables under the control shape and 109,781 under the index. A single-file pass inside the loaded corpus — the file-watcher's shape, and the one the 199 calls were — reads 212,275 against **8**.",
    },
  ],

  verdict:
    "A SCAN-SHAPE fix on the incremental path and an EXPLANATION at cold load. The by-file index takes a single-file resolve inside the full corpus from 212,275 callables and 916,801 registry entries to 8 and 8, and its CPU from 132.7 to 74.5 ms (1.78x, five reps per arm). Over a cold whole-corpus load it buys nothing measurable — +112.8 ms on a term whose run-to-run spread is 13% — because the scan it removes from that one pass is 16.3 ms of a 353 s run. The growth the task was written against is real and is NOT that scan: it is polymorphic dispatch, whose enumerated subtype edges grow at exponent 1.726 and whose CPU grows at 1.881 while the call sites feeding it grow at 1.013. That is the cost of a bigger answer — 16.77 subtypes enumerated per expansion at 8,494 files against 4.64 at 927 — and no index removes it.",

  note:
    "Eight full-corpus arms interleaved control,candidate,control,candidate,control,candidate,control,candidate, one process each, forward order, at --max-old-space-size=12288; the control is a second worktree of the same repository sharing the primary checkout's node_modules, so both arms resolve tree-sitter 0.25.0 and tree-sitter-typescript 0.23.2. " +
    "Every CPU figure in `arms` and `growth_curve` comes from a `process.cpuUsage()` delta taken by a prototype wrapper, in a process with no profiler attached. `term_split` comes from separate `--cpu-prof` runs at each size, which sample wall and attribute less than the wrapper measures — 12,201.8 ms against 15,104.7 ms in the same process — so it is read as proportions and never as a budget. " +
    "`dispatch_enumeration` comes from a third kind of run, with counters wrapped on `DefinitionRegistry.get_subtypes` and `get_member_index`; the counting inflates that run's CPU, so no timing figure here comes from those arms. " +
    "The candidate's growth curve was taken at one process per size — 1,287.1 ms at 927 files and 2,148.5 ms at 2,000 — and is not quoted as a spread. " +
    "All seven fingerprint components and both diagnostics hashes are identical between the two builds at 200, 1,200 and 8,494 files, and the 8,494-file values are the ones `RECORDED_ORDER_INDEPENDENCE` already holds for this corpus in forward order.",
};
