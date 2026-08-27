/**
 * What a whole corpus costs, measured by offering every discovered file to one
 * process on the tree that ships.
 *
 * This is the row every later step in the load-performance work is judged
 * against, and it exists because a corpus-scale figure taken any other way has
 * been wrong every time it was checked. Two fits from small slices missed the
 * measured corpus cost by 2.19x and 16.8x, and a composed prototype's structural
 * output — 7,891 indexed, 603 dropped, 183,018 nodes — does not describe the
 * landed tree, which indexes 7,818, drops 676 and reports 184,957. So nothing
 * here is projected: every number comes from a run of every file its predicate
 * discovered.
 *
 * Absolute CPU is machine-bound and does not transfer between sessions, so the
 * absolutes below are a record and the RATIOS come from a control arm — the tree
 * as it stood before this work began — run interleaved with the candidate in the
 * same session on the same box. The control arm is measured over nested slices
 * rather than over the corpus because the unpatched tree does not finish the
 * corpus: the ratio it buys is 1.52x at 200 files, 2.09x at 600 and 3.40x at
 * 1,200, and a ratio that rises with the file set is the reason the corpus-scale
 * one may not be extrapolated from any of them.
 *
 * The phase split answers where the load's cost is, because that is what the
 * per-file cost work is scoped from. Two terms in it settle open questions.
 * `Project.remove_file` is called ZERO times over a corpus load — the bulk
 * driver rolls a failed ingest back through `evict_ingested_file`, which costs
 * 187.1 ms over 676 rollbacks — so the drop-rollback cascade that once held
 * 44.5% of the run is already gone. And resolution is not where the time is
 * either: name resolution is 0.53% of the run and call resolution 4.04%, against
 * 85.03% for parse and index, of which more than half is spent crossing the
 * JavaScript/native boundary to read tree-sitter node fields.
 */

/** Repeated observations of one quantity, summarized the way the harness does. */
interface RecordedSpread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  /** `(max - min) / mean`, as a percentage. */
  readonly spread_percent: number;
  /** Coefficient of variation, as a percentage. */
  readonly cv_percent: number;
  /** Every observation, so the summary can be recomputed rather than trusted. */
  readonly observations: readonly number[];
}

/**
 * One corpus predicate, run to completion in each of several processes.
 *
 * Both predicates are recorded because they answer the ten-minute question
 * differently, and a row for one is never divided into a row for the other.
 */
interface RecordedCorpusArm {
  readonly predicate: string;
  /** What the predicate's walk found. Every one of them is offered. */
  readonly discovered_files: number;
  readonly offered: number;
  readonly indexed: number;
  readonly dropped: number;
  /** Independent processes, each running the whole corpus. */
  readonly processes: number;
  /** V8's old-space ceiling as the process reported it. */
  readonly heap_cap_mb: number;
  readonly cpu_seconds: RecordedSpread;
  readonly wall_seconds: readonly number[];
  /** Near 1.0 on an idle box; far below it under contention. */
  readonly cpu_per_wall: readonly number[];
  readonly loadavg_at_arm_start: readonly number[];
  readonly peak_rss_mb: RecordedSpread;
  /**
   * V8's used heap when the arm finished. Recorded beside peak RSS rather than
   * instead of it, and NOT as a stable figure: at a 12,288 MB ceiling the corpus
   * never forces a full collection, so this reads the GC schedule as much as the
   * retention.
   */
  readonly settled_heap_mb: RecordedSpread;
  /** Each of the seven components as `count/hash`, identical in every process. */
  readonly fingerprint: Readonly<Record<string, string>>;
  /** The diagnostics payload's pair of digests, identical in every process. */
  readonly diagnostics: Readonly<Record<string, string | number>>;
}

/** One slice of the interleaved control-versus-candidate pair. */
interface RecordedControlSlice {
  readonly offered_files: number;
  readonly indexed: number;
  readonly dropped: number;
  /** Independent processes per arm, run control,candidate,control,candidate. */
  readonly reps_per_arm: number;
  readonly control_cpu_seconds: readonly number[];
  readonly candidate_cpu_seconds: readonly number[];
  /** Control CPU over candidate CPU, both means. Above 1.0 favours the candidate. */
  readonly ratio: number;
  readonly control_peak_rss_mb: number;
  readonly candidate_peak_rss_mb: number;
}

/**
 * One named phase of the load, and where its number came from.
 *
 * Most are exact: a `process.cpuUsage()` delta taken across the phase boundary
 * by a wrapper installed on the class prototype from outside, so no production
 * file is touched and no phase is estimated from a share. The one exception is
 * named as sampled, because its boundary is a module-local function that cannot
 * be wrapped from outside the module.
 */
interface RecordedPhase {
  readonly phase: string;
  /** The function whose inclusive CPU this is. */
  readonly boundary: string;
  /**
   * The phase this one is nested inside, or `"the run"` for a top-level term.
   * Only the top-level terms partition the run; the rest break one of them down,
   * and adding them all together would count their time twice.
   */
  readonly contained_by: string;
  readonly calls: number;
  readonly cpu_ms: number;
  /** Percentage of the total CPU of the run this phase's figure came from. */
  readonly share_percent: number;
  readonly source: "cpuUsage delta at the boundary" | "cpu-prof sample";
}

/**
 * Where the load's CPU goes inside parse-and-index, by self time under the load
 * and trace subtrees of a full-corpus `--cpu-prof` run.
 */
interface RecordedCostCentre {
  readonly centre: string;
  readonly cpu_ms: number;
  readonly share_percent: number;
  readonly what_it_is: string;
}

/** A figure that is kept rather than deleted, with what replaced it and why. */
interface RecordedSupersession {
  readonly claim: string;
  readonly reason: string;
  readonly outcome: string;
}

export interface RecordedFullCorpusBaseline {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  /** Every arm below shares it, which is what makes the ratios admissible. */
  readonly session_id: string;
  /** The tree the candidate arms measure. */
  readonly ariadne_commit: string;
  /** The tree the control arm measures: this work's starting point. */
  readonly control_commit: string;
  readonly ingest_order: string;
  /**
   * Every defensible file count for this corpus, each re-counted in this
   * session. Four of them, differing by up to 49%, which is why a count is
   * never quoted without its predicate.
   */
  readonly discovery_counts: Readonly<Record<string, number>>;
  readonly corpora: readonly RecordedCorpusArm[];
  readonly control_arm: readonly RecordedControlSlice[];
  /** Why the control arm is measured over slices and not over the corpus. */
  readonly control_arm_scope: string;
  /** The predicate whose corpus the phase split was taken over. */
  readonly phase_split_predicate: string;
  /** The total CPU of the one run the phase split partitions. */
  readonly phase_split_total_cpu_ms: number;
  readonly phase_split: readonly RecordedPhase[];
  readonly cost_centres: readonly RecordedCostCentre[];
  readonly cost_centres_scope: string;
  readonly superseded: readonly RecordedSupersession[];
  readonly note: string;
}

export const RECORDED_FULL_CORPUS_BASELINE: RecordedFullCorpusBaseline = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  total_memory_mb: 32768,
  session_id: "task-381.7-2026-08-27",
  ariadne_commit: "25af64a8",
  control_commit: "2970604b",
  ingest_order: "forward",

  discovery_counts: {
    "Ariadne's walk over `src/`": 8494,
    "Ariadne's walk at the repository root": 12654,
    "shell: `.ts` under `src/` excluding `.d.ts`": 8451,
    "shell: `.ts` under `src/` including `.d.ts`": 8648,
  },

  corpora: [
    {
      predicate: "src",
      discovered_files: 8494,
      offered: 8494,
      indexed: 7818,
      dropped: 676,
      processes: 3,
      heap_cap_mb: 12336,
      cpu_seconds: {
        mean: 337.3,
        min: 333.44,
        max: 340.75,
        spread_percent: 2.17,
        cv_percent: 0.89,
        observations: [340.7517, 337.6952, 333.4418],
      },
      wall_seconds: [325.5, 327.7, 321.8],
      cpu_per_wall: [1.05, 1.03, 1.04],
      loadavg_at_arm_start: [3.1, 4.5, 4.1],
      peak_rss_mb: {
        mean: 7177.63,
        min: 6668,
        max: 7544,
        spread_percent: 12.2,
        cv_percent: 5.18,
        observations: [7320.9, 6668, 7544],
      },
      settled_heap_mb: {
        mean: 6434.9,
        min: 4691.3,
        max: 7322.9,
        spread_percent: 40.9,
        cv_percent: 19.16,
        observations: [4691.3, 7322.9, 7290.5],
      },
      fingerprint: {
        nodes: "184957/eee36b26277fd292",
        call_edges: "322300/ac7bfdba0b002ff8",
        unresolved_calls: "543967/33d7de4ce0a7030d",
        raw_entry_points: "19816/9e8736700b47aa37",
        indirect_reachability_keys: "25811/16f2c4325fb5fba9",
        dropped_files: "676/003c1db7f45416b0",
        indirect_reachability_evidence: "25811/b87a2c5f358d23a4",
      },
      diagnostics: {
        entry_point_count: 19816,
        diag_hash: "d73ce9fdb980ca14",
        canonical_hash: "f5ad492280537a41",
      },
    },
    {
      predicate: "repository-root",
      discovered_files: 12654,
      offered: 12654,
      indexed: 11659,
      dropped: 995,
      processes: 2,
      // 12,654 files need 18,116 MB by the harness's own requirement, so the
      // 12,288 MB the `src/` arms take is refused here before any CPU is spent.
      heap_cap_mb: 22693,
      cpu_seconds: {
        mean: 1105.73,
        min: 1069.61,
        max: 1141.84,
        spread_percent: 6.53,
        cv_percent: 3.27,
        observations: [1069.6101, 1141.8404],
      },
      wall_seconds: [1068.8, 1149.4],
      cpu_per_wall: [1, 0.99],
      loadavg_at_arm_start: [2.6, 3.2],
      peak_rss_mb: {
        mean: 8352.55,
        min: 8238,
        max: 8467.1,
        spread_percent: 2.74,
        cv_percent: 1.37,
        observations: [8467.1, 8238],
      },
      settled_heap_mb: {
        mean: 8299.75,
        min: 7965.3,
        max: 8634.2,
        spread_percent: 8.06,
        cv_percent: 4.03,
        observations: [8634.2, 7965.3],
      },
      fingerprint: {
        nodes: "242533/c48b8f4bfd2fef9c",
        call_edges: "405528/7bbe471073531f7b",
        unresolved_calls: "715261/78ac568d5d67e73b",
        raw_entry_points: "24805/e67ef60569bc75b5",
        indirect_reachability_keys: "36414/565a919aa70faf17",
        dropped_files: "995/9efaf8ac3659dc14",
        indirect_reachability_evidence: "36414/c15b2446a2baf755",
      },
      diagnostics: {
        entry_point_count: 24805,
        diag_hash: "d7b8ff5426dd8e04",
        canonical_hash: "6e62476829899e63",
      },
    },
  ],

  control_arm: [
    {
      offered_files: 200,
      indexed: 187,
      dropped: 13,
      reps_per_arm: 2,
      control_cpu_seconds: [15.4007, 15.2722],
      candidate_cpu_seconds: [10.1034, 10.107],
      ratio: 1.52,
      control_peak_rss_mb: 560.85,
      candidate_peak_rss_mb: 356.5,
    },
    {
      offered_files: 600,
      indexed: 572,
      dropped: 28,
      reps_per_arm: 2,
      control_cpu_seconds: [50.9585, 49.6446],
      candidate_cpu_seconds: [24.2952, 23.9133],
      ratio: 2.09,
      control_peak_rss_mb: 1187.95,
      candidate_peak_rss_mb: 648.6,
    },
    {
      offered_files: 1200,
      indexed: 1145,
      dropped: 55,
      reps_per_arm: 2,
      control_cpu_seconds: [156.7128, 156.9531],
      candidate_cpu_seconds: [46.2451, 46.0891],
      ratio: 3.4,
      control_peak_rss_mb: 2273,
      candidate_peak_rss_mb: 1101.8,
    },
  ],

  control_arm_scope:
    "Nested path-ordered prefixes, not the corpus, because the control tree does not finish the corpus: it is the build that spent 11.23 hours and died at file 6,634 of 8,494. " +
    "Both arms ran in one session on one box, interleaved control,candidate,control,candidate, forward order, one process per arm at --max-old-space-size=6144, and each arm ran its own checkout's script. " +
    "The ratio rises with the file set — 1.52x, 2.09x, 3.40x — so none of these is the corpus-scale ratio and no fit over them is admissible. " +
    "The two arms index and drop identically at every slice (187/13, 572/28, 1145/55), so the ratio is a cost difference over one file set rather than a coverage difference. " +
    "Their reported graphs differ by design: the candidate carries the callback-attribution repair and the two-phase corpus pass, which move nodes 4,629 -> 4,647 and call edges 37,163 -> 39,687 at 1,200 files.",

  phase_split_predicate: "src",
  phase_split_total_cpu_ms: 344407.9,

  phase_split: [
    {
      phase: "parse and index",
      boundary: "Project.ingest_file",
      contained_by: "the run",
      calls: 8494,
      cpu_ms: 292833.1,
      share_percent: 85.03,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "the rest of the load",
      boundary:
        "load_project outside ingest_file, resolve_corpus and rollback — reading 8,494 files and the loader's own bookkeeping",
      contained_by: "the run",
      calls: 1,
      cpu_ms: 26873.4,
      share_percent: 7.8,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "resolve the corpus",
      boundary: "Project.resolve_corpus",
      contained_by: "the run",
      calls: 1,
      cpu_ms: 24074.6,
      share_percent: 6.99,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "fix import locations",
      boundary: "Project.fix_import_locations_for_file",
      contained_by: "resolve the corpus",
      calls: 7818,
      cpu_ms: 7074.4,
      share_percent: 2.05,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "resolve_names",
      boundary: "ResolutionRegistry.resolve_names",
      contained_by: "resolve the corpus",
      calls: 1,
      cpu_ms: 1823.9,
      share_percent: 0.53,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "resolve_calls_for_files",
      boundary: "ResolutionRegistry.resolve_calls_for_files",
      contained_by: "resolve the corpus",
      calls: 1,
      cpu_ms: 13928.7,
      share_percent: 4.04,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "resolve_callback_invocations",
      boundary:
        "resolve_callback_invocations — module-local, so sampled rather than wrapped",
      contained_by: "resolve_calls_for_files",
      calls: 1,
      cpu_ms: 1907.9,
      share_percent: 0.51,
      source: "cpu-prof sample",
    },
    {
      phase: "drop rollback",
      boundary: "Project.evict_ingested_file",
      contained_by: "the run",
      calls: 676,
      cpu_ms: 187.1,
      share_percent: 0.05,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "drop rollback through the incremental API",
      boundary: "Project.remove_file",
      contained_by: "the run",
      calls: 0,
      cpu_ms: 0,
      share_percent: 0,
      source: "cpuUsage delta at the boundary",
    },
    {
      phase: "trace_call_graph",
      boundary: "trace_call_graph",
      contained_by: "the run",
      calls: 1,
      cpu_ms: 439.7,
      share_percent: 0.13,
      source: "cpuUsage delta at the boundary",
    },
  ],

  cost_centres: [
    {
      centre: "tree-sitter node-boundary marshalling",
      cpu_ms: 150618,
      share_percent: 51.28,
      what_it_is:
        "`get type`, `get parent`, `childForFieldName`, `unmarshalNode`, the position and index getters, `get children`, `marshalNode` and `child` — one JavaScript/native crossing per field read on a node",
    },
    {
      centre: "Query.captures",
      cpu_ms: 22283,
      share_percent: 7.59,
      what_it_is: "running the tree-sitter queries that drive indexing",
    },
    {
      centre: "Parser.parse",
      cpu_ms: 14693,
      share_percent: 5,
      what_it_is: "parsing source text into a tree",
    },
    {
      centre: "references.process",
      cpu_ms: 16892,
      share_percent: 5.75,
      what_it_is: "the reference pass over each file's captures",
    },
    {
      centre: "scopes/boundary_base get",
      cpu_ms: 8436,
      share_percent: 2.87,
      what_it_is: "scope containment questions asked during indexing",
    },
  ],

  cost_centres_scope:
    "Self time under the ingest_file, evict_ingested_file, resolve_corpus and trace_call_graph subtrees of one full-corpus --cpu-prof run over `src/`: 293.7 s of samples inside those subtrees, of a 375.5 s profile. " +
    "Shares are of the 293.7 s, not of the process. Garbage collection lands outside those subtrees in this profile (29.9 s at top level) and file reads are asynchronous, so neither is in the denominator.",

  superseded: [
    {
      claim:
        "A repaired export gate costs 855 s / 14.24 min over `src/`, up from the 778 s the stack alone measured.",
      reason:
        "It priced the 603 readmitted files at the local marginal cost of a file, without knowing that removing the gate also removes the rollback cascade the drops caused.",
      outcome:
        "REFUTED at 462.9 s on the composed prototype. On this tree the projection is doubly void: the rollback cascade is ALREADY zero — `Project.remove_file` is called 0 times and the whole rollback path costs 187.1 ms over 676 drops — so what a repaired gate costs here is the marginal cost of the readmitted files alone, which is TASK-381.8's to measure against its own same-session control.",
    },
    {
      claim:
        "The export gate's cost is measured by running the corpus with the gated files WITHHELD, at 833.3 s against 423.4 s.",
      reason:
        "Withholding files changes the input, so the two arms describe different corpora and the difference includes the cost of files one arm never saw. Reverse-applying the repair changes the code and leaves the input alone.",
      outcome:
        "SUPERSEDED as the measurement and kept as the estimate that first sized the problem. TASK-381.8 is judged against an interleaved same-session control arm carrying the identical stack with the repair reverse-applied.",
    },
    {
      claim:
        "A fixed CPU ceiling (<= 850 s over `src/`) is the criterion this checkpoint passes or fails.",
      reason:
        "Absolute CPU is machine-bound: identical computation with byte-identical structural output measured 777.6 s, 801.3 s and 1,019.4 s in three sessions on one machine.",
      outcome:
        "REPLACED by an absolute recorded as a mean over at least two processes with its CV, cpu/wall, loadavg, machine and node version, plus a ratio taken only against an interleaved control arm in the same session. The absolute here is 337.3 s at CV 0.89% on a 6-core box, and it is not comparable with the 510.3 s or 777.6 s recorded elsewhere.",
    },
    {
      claim:
        "The phase split is rollback 44.5%, tree-sitter marshalling 29.3%, `resolve_calls_for_files` 5.7%, `trace_call_graph` 0.08%.",
      reason:
        "It was taken on a composed prototype whose bulk load still rolled a failed ingest back through the incremental `remove_file`, re-resolving every dependent of each dropped file.",
      outcome:
        "RE-MEASURED on the landed tree: rollback 0.05%, marshalling 51.28% of the load-and-trace subtrees, `resolve_calls_for_files` 4.04%, `trace_call_graph` 0.13%. The rollback term went to zero through the two-phase driver's `evict_ingested_file` rather than through the gate repair, and the term it uncovered is the tree-sitter node boundary.",
    },
    {
      claim:
        "The composed prototype's structural output — 7,891 indexed, 603 dropped, 183,018 nodes, 1,502,343 call references, 26,610 indirect entries — describes what the landed stack reports.",
      reason:
        "The prototype patches were cut before `registries/export.ts` and `project/project.ts` were rewritten, and each landed step was merged by hand against the current tree.",
      outcome:
        "REFUTED. The landed tree indexes 7,818 of 8,494 with 676 dropped and reports 184,957 nodes, 322,300 call edges, 19,816 raw entry points and 25,811 indirect-reachability keys. Every prototype figure is superseded by the row above, which is what this checkpoint exists to establish.",
    },
  ],

  note:
    "Every arm offered every file its predicate discovered to one process and ran to completion. The `src/` arms ran at --max-old-space-size=12288 on the harness command line, the repository-root arms at 22645 because the harness refuses a 12,654-file arm below 18,116 MB, and Ariadne sets no heap flag itself. " +
    "The seven fingerprint components and both diagnostics digests are byte-identical across FIVE independent processes over `src/` — three clean arms, one arm with the phase-boundary wrappers installed, one arm under --cpu-prof — and across both repository-root processes. The wrappers and the profiler therefore change nothing the run reports. " +
    "Entry-point detection is free and the whole cost is the load: `trace_call_graph` is 439.7 ms of 344,407.9. " +
    "Every phase but one is an exact CPU delta over the run whose total is `phase_split_total_cpu_ms`. `resolve_callback_invocations` is module-local and cannot be wrapped from outside its module, so it is sampled in a second full-corpus run under --cpu-prof: 1,907.9 ms of that run's 375.5 s of samples, which is 24.02% of the 7,943.1 ms the same profile attributes to the `resolve_calls_for_files` that contains it. " +
    "Peak RSS is a mean over its processes with the spread beside it, and the settled heap next to it is NOT the stable figure it is at a smaller ceiling: at 12,288 MB the corpus never forces a full collection and the three `src/` readings spread 40.9%, so the RSS-to-heap ratio is not a constant on this row and must not be quoted as one. " +
    "The two predicates answer the ten-minute question differently, as they did before: `src/` is 5.62 minutes of CPU and 5.42 of wall; the repository root is 49% more files for 3.28x the CPU, 18.43 minutes, and does not come under ten by either clock.",
};
