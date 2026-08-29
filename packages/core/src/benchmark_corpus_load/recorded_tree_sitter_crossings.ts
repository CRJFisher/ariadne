/**
 * What indexing costs at the JavaScript/native boundary, and what it costs once
 * a node stops being asked the same question twice.
 *
 * Two quantities, measured separately because one travels between machines and
 * the other does not. `accessor_calls` counts crossings — a property of the
 * algorithm and the corpus, reproducible anywhere — and `binding_self_time`
 * counts CPU-seconds inside `tree-sitter/index.js`, which is a property of this
 * box and this session.
 *
 * The largest single term was a read the binding intends to be free. It mints
 * one JavaScript class per node type id and then assigns the type name onto
 * that class, but the assignment travels through `SyntaxNode`'s getter-only
 * accessor in sloppy mode and is a silent no-op, so every `node.type` in the
 * pipeline marshalled the node and called the addon: 14,328 crossings per
 * indexed file, 45.7% of all of them, 42.91 CPU-seconds over the corpus.
 * Holding the name where the binding meant to hold it takes that to one
 * crossing per type id per process.
 *
 * The rest is the same shape at smaller scale: a capture's text sliced from the
 * source between the two Points its location already read rather than fetched
 * through two more crossings, a construct-target chain answered once per
 * ancestor rather than once per call beneath it, a JSDoc comment reached as the
 * declaration's previous sibling rather than by enumerating its parent's
 * children, and three child-index loops reading the child list once.
 *
 * `binding_self_time` is the criterion. It is taken under `--cpu-prof`, so its
 * arms are NOT the arms `corpus_arms` reports: a profiled process spends 40%
 * more CPU, and mixing the two would launder profiler overhead into a speedup.
 */

/** Repeated observations of one quantity, summarized the way the harness does. */
interface RecordedSpread {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
  /** `(max - min) / mean`, as a percentage. */
  readonly spread_percent: number;
  readonly observations: readonly number[];
}

/**
 * One tree-sitter Node accessor, and how many times indexing the sample called
 * it under each tree.
 *
 * `text` is listed because it is a Node accessor the code reads, but it does
 * not itself reach the addon: `tree.getText` is JavaScript, and the two
 * crossings it makes are the `startIndex` and `endIndex` rows beside it. The
 * headline percentage is quoted both ways for that reason.
 */
interface RecordedAccessorCalls {
  readonly accessor: string;
  readonly control: number;
  readonly candidate: number;
  readonly reaches_the_addon: boolean;
}

/** One `tree-sitter/index.js` frame, and its self-time over a whole corpus. */
interface RecordedBindingFrame {
  readonly frame: string;
  readonly control_s: number;
  readonly candidate_s: number;
}

/** One full-corpus process run with a profiler attached. */
interface RecordedProfiledArm {
  readonly arm: "control" | "candidate";
  readonly sequence_index: number;
  /** Self-time summed over every `tree-sitter/index.js` frame. */
  readonly binding_self_time_s: number;
  /** That figure over the profile's whole sampled self-time. */
  readonly binding_share_percent: number;
  readonly profile_sampled_self_time_s: number;
  /** `process.cpuUsage()` for the arm, WITH the profiler attached. */
  readonly run_cpu_s: number;
  readonly loadavg_at_start: number;
}

/** One full-corpus process: one checkout, one whole-corpus load and trace. */
interface RecordedCorpusArm {
  readonly arm: "control" | "candidate";
  readonly sequence_index: number;
  /** Discovery, load and trace, cpu_user + cpu_system, no profiler attached. */
  readonly run_cpu_s: number;
  readonly wall_s: number;
  readonly cpu_per_wall: number;
  readonly peak_rss_mb: number;
  readonly loadavg_at_start: number;
}

/**
 * One pass over the size-stratified sample: each file read, parsed and indexed
 * exactly once, in path order, in a process of its own.
 */
interface RecordedSampleArm {
  readonly arm: "control" | "candidate";
  readonly sequence_index: number;
  /** `build_index_single_file` alone. */
  readonly index_ms_per_file: number;
  /** The tree-sitter parse and the index together. */
  readonly parse_and_index_ms_per_file: number;
}

/** One corpus size at which the two trees are asked whether they agree. */
interface RecordedFingerprintAgreement {
  readonly offered_files: number;
  readonly control_cpu_s: RecordedSpread;
  readonly candidate_cpu_s: RecordedSpread;
  readonly speedup: number;
  readonly identical: boolean;
}

/** What the two trees compile, and how often, so the parser config claim is a count. */
interface RecordedQueryCompilation {
  readonly offered_files: number;
  readonly dialects: readonly string[];
  readonly compilations: number;
  /** `Query.captures` calls over the 200-file sample — one batch per file. */
  readonly captures_calls_per_file: number;
  readonly parser_buffer_sizing: string;
}

/** A neighbouring change this batch refuses, with the reading that refuses it. */
interface RecordedExclusion {
  readonly what: string;
  readonly measured: string;
  readonly reason: string;
}

export interface RecordedTreeSitterCrossings {
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
  /** The tree this step's control arms measure: the epic's stack through TASK-381.13. */
  readonly control_commit: string;
  /** The tree its candidate arms measure. */
  readonly candidate_commit: string;
  readonly heap_ceiling_mb: number;

  /** How the 200 files were chosen, and what distribution they carry. */
  readonly sample_construction: string;
  readonly sample_files: number;
  readonly sample_mean_bytes: number;
  readonly corpus_mean_bytes: number;
  /** References the sample yields under both trees — the same number. */
  readonly sample_references: number;
  readonly sample_scopes: number;

  readonly accessor_calls: readonly RecordedAccessorCalls[];
  readonly crossings_per_file_control: number;
  readonly crossings_per_file_candidate: number;
  readonly crossings_fall_percent: number;
  /** The same fall counting only the accessors that reach the addon. */
  readonly addon_crossings_fall_percent: number;
  readonly counting_instrument: string;

  readonly profiled_arms: readonly RecordedProfiledArm[];
  readonly control_binding_self_time_s: RecordedSpread;
  readonly candidate_binding_self_time_s: RecordedSpread;
  /** Control mean minus candidate mean. Positive is a saving. */
  readonly binding_self_time_saving_s: number;
  /** Recorded on both arms; no threshold is asserted on it. */
  readonly control_binding_share_percent: number;
  readonly candidate_binding_share_percent: number;
  readonly binding_frames: readonly RecordedBindingFrame[];

  readonly corpus_arms: readonly RecordedCorpusArm[];
  readonly control_run_cpu_s: RecordedSpread;
  readonly candidate_run_cpu_s: RecordedSpread;
  readonly corpus_saving_s: number;
  readonly corpus_saving_ms_per_file: number;
  readonly corpus_speedup: number;

  readonly sample_arms: readonly RecordedSampleArm[];
  readonly control_index_ms_per_file: RecordedSpread;
  readonly candidate_index_ms_per_file: RecordedSpread;
  readonly sample_saving_ms_per_file: number;

  readonly fingerprint_agreement: readonly RecordedFingerprintAgreement[];
  /** The seven components, identical under both trees at the full corpus. */
  readonly full_corpus_fingerprint: Readonly<Record<string, string>>;
  /** The payload as emitted — membership and evidence-list order. Identical. */
  readonly diag_hash: string;
  /** The deep-sorted payload — membership alone. Identical. */
  readonly canonical_hash: string;

  readonly query_compilation: RecordedQueryCompilation;
  readonly type_name_equivalence: string;
  readonly capture_text_equivalence: string;

  readonly not_in_scope: readonly RecordedExclusion[];
  readonly verdict: string;
  readonly note: string;
}

export const RECORDED_TREE_SITTER_CROSSINGS: RecordedTreeSitterCrossings = {
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
  control_commit: "4be67581",
  candidate_commit: "87d94d30",
  heap_ceiling_mb: 15365,

  sample_construction:
    "The 8,494 discovered files sorted by byte size, cut into eight equal-count strata, 25 files taken at even positions inside each. Mean file size 12,278 bytes against the corpus's 12,944, a 5.1% shortfall that comes from the one 1,377,561-byte file no 200-file sample of this construction reaches.",
  sample_files: 200,
  sample_mean_bytes: 12278,
  corpus_mean_bytes: 12944,
  sample_references: 160785,
  sample_scopes: 8338,

  accessor_calls: [
    {
      accessor: "type",
      control: 2865539,
      candidate: 156,
      reaches_the_addon: true,
    },
    {
      accessor: "parent",
      control: 601035,
      candidate: 405109,
      reaches_the_addon: true,
    },
    {
      accessor: "childForFieldName",
      control: 485140,
      candidate: 475436,
      reaches_the_addon: true,
    },
    {
      accessor: "text",
      control: 411185,
      candidate: 198395,
      reaches_the_addon: false,
    },
    {
      accessor: "startIndex",
      control: 411185,
      candidate: 198395,
      reaches_the_addon: true,
    },
    {
      accessor: "endIndex",
      control: 411185,
      candidate: 198395,
      reaches_the_addon: true,
    },
    {
      accessor: "startPosition",
      control: 295692,
      candidate: 295692,
      reaches_the_addon: true,
    },
    {
      accessor: "endPosition",
      control: 295692,
      candidate: 295692,
      reaches_the_addon: true,
    },
    {
      accessor: "childCount",
      control: 205497,
      candidate: 0,
      reaches_the_addon: true,
    },
    {
      accessor: "child",
      control: 175344,
      candidate: 626,
      reaches_the_addon: true,
    },
    {
      accessor: "children",
      control: 59692,
      candidate: 84716,
      reaches_the_addon: true,
    },
    {
      accessor: "id",
      control: 30461,
      candidate: 30461,
      reaches_the_addon: true,
    },
    {
      accessor: "namedChildren",
      control: 12237,
      candidate: 12237,
      reaches_the_addon: true,
    },
    {
      accessor: "previousSibling",
      control: 0,
      candidate: 14645,
      reaches_the_addon: true,
    },
    {
      accessor: "firstChild",
      control: 4711,
      candidate: 4711,
      reaches_the_addon: true,
    },
    {
      accessor: "namedChildCount",
      control: 2514,
      candidate: 2514,
      reaches_the_addon: true,
    },
    {
      accessor: "namedChild",
      control: 1982,
      candidate: 1982,
      reaches_the_addon: true,
    },
    {
      accessor: "Query.captures",
      control: 200,
      candidate: 200,
      reaches_the_addon: true,
    },
  ],
  crossings_per_file_control: 31346.5,
  crossings_per_file_candidate: 11096.8,
  crossings_fall_percent: 64.6,
  addon_crossings_fall_percent: 65.5,
  counting_instrument:
    "A probe outside the repository that replaces every accessor on `SyntaxNode.prototype` with a counting wrapper BEFORE it imports the checkout under test, so a crossing a tree makes once per process is counted rather than hidden behind a reference the tree captured earlier. The same probe file runs both arms, and counting is live only across `build_index_single_file` — the parse is outside the window, so no parser change could be read as an indexing change.",

  profiled_arms: [
    {
      arm: "control",
      sequence_index: 0,
      binding_self_time_s: 183.78,
      binding_share_percent: 45.86,
      profile_sampled_self_time_s: 400.72,
      run_cpu_s: 321.83,
      loadavg_at_start: 4.3,
    },
    {
      arm: "candidate",
      sequence_index: 1,
      binding_self_time_s: 120.6,
      binding_share_percent: 36.07,
      profile_sampled_self_time_s: 334.33,
      run_cpu_s: 238.57,
      loadavg_at_start: 4.6,
    },
    {
      arm: "control",
      sequence_index: 2,
      binding_self_time_s: 185.95,
      binding_share_percent: 45.82,
      profile_sampled_self_time_s: 405.86,
      run_cpu_s: 321.32,
      loadavg_at_start: 5.6,
    },
    {
      arm: "candidate",
      sequence_index: 3,
      binding_self_time_s: 122.29,
      binding_share_percent: 36.88,
      profile_sampled_self_time_s: 331.61,
      run_cpu_s: 240.15,
      loadavg_at_start: 5.5,
    },
  ],
  control_binding_self_time_s: {
    mean: 184.87,
    min: 183.78,
    max: 185.95,
    spread_percent: 1.17,
    observations: [183.78, 185.95],
  },
  candidate_binding_self_time_s: {
    mean: 121.45,
    min: 120.6,
    max: 122.29,
    spread_percent: 1.39,
    observations: [120.6, 122.29],
  },
  binding_self_time_saving_s: 63.42,
  control_binding_share_percent: 45.84,
  candidate_binding_share_percent: 36.48,

  binding_frames: [
    { frame: "get type", control_s: 42.91, candidate_s: 0.0 },
    { frame: "get parent", control_s: 34.91, candidate_s: 26.83 },
    { frame: "Query.captures", control_s: 22.36, candidate_s: 22.42 },
    { frame: "Parser.parse", control_s: 14.89, candidate_s: 14.66 },
    { frame: "childForFieldName", control_s: 14.1, candidate_s: 14.41 },
    { frame: "unmarshalNode", control_s: 11.26, candidate_s: 8.88 },
    { frame: "unmarshalNodes", control_s: 6.03, candidate_s: 7.82 },
    { frame: "get startIndex", control_s: 5.7, candidate_s: 2.74 },
    { frame: "get endIndex", control_s: 5.59, candidate_s: 2.5 },
    { frame: "get children", control_s: 4.25, candidate_s: 6.44 },
    { frame: "marshalNode", control_s: 4.02, candidate_s: 1.39 },
    { frame: "child", control_s: 3.88, candidate_s: 0.03 },
    { frame: "get startPosition", control_s: 3.78, candidate_s: 4.17 },
    { frame: "get endPosition", control_s: 3.6, candidate_s: 3.92 },
    { frame: "get childCount", control_s: 2.65, candidate_s: 0.0 },
    { frame: "getTextFromString", control_s: 1.2, candidate_s: 0.64 },
    { frame: "get previousSibling", control_s: 0.0, candidate_s: 1.32 },
  ],

  corpus_arms: [
    {
      arm: "control",
      sequence_index: 0,
      run_cpu_s: 299.31,
      wall_s: 287.19,
      cpu_per_wall: 1.04,
      peak_rss_mb: 8589.9,
      loadavg_at_start: 3.2,
    },
    {
      arm: "candidate",
      sequence_index: 1,
      run_cpu_s: 225.49,
      wall_s: 216.72,
      cpu_per_wall: 1.04,
      peak_rss_mb: 7779.2,
      loadavg_at_start: 3.3,
    },
    {
      arm: "control",
      sequence_index: 2,
      run_cpu_s: 300.48,
      wall_s: 287.71,
      cpu_per_wall: 1.04,
      peak_rss_mb: 6872.4,
      loadavg_at_start: 4.1,
    },
    {
      arm: "candidate",
      sequence_index: 3,
      run_cpu_s: 226.98,
      wall_s: 217.37,
      cpu_per_wall: 1.04,
      peak_rss_mb: 7078.1,
      loadavg_at_start: 4.4,
    },
  ],
  control_run_cpu_s: {
    mean: 299.9,
    min: 299.31,
    max: 300.48,
    spread_percent: 0.39,
    observations: [299.31, 300.48],
  },
  candidate_run_cpu_s: {
    mean: 226.24,
    min: 225.49,
    max: 226.98,
    spread_percent: 0.66,
    observations: [225.49, 226.98],
  },
  corpus_saving_s: 73.66,
  corpus_saving_ms_per_file: 8.672,
  corpus_speedup: 1.33,

  sample_arms: [
    {
      arm: "control",
      sequence_index: 0,
      index_ms_per_file: 23.844,
      parse_and_index_ms_per_file: 25.428,
    },
    {
      arm: "candidate",
      sequence_index: 1,
      index_ms_per_file: 17.136,
      parse_and_index_ms_per_file: 18.694,
    },
    {
      arm: "control",
      sequence_index: 2,
      index_ms_per_file: 24.166,
      parse_and_index_ms_per_file: 25.723,
    },
    {
      arm: "candidate",
      sequence_index: 3,
      index_ms_per_file: 17.58,
      parse_and_index_ms_per_file: 19.153,
    },
    {
      arm: "control",
      sequence_index: 4,
      index_ms_per_file: 24.404,
      parse_and_index_ms_per_file: 25.952,
    },
    {
      arm: "candidate",
      sequence_index: 5,
      index_ms_per_file: 17.431,
      parse_and_index_ms_per_file: 19.015,
    },
  ],
  control_index_ms_per_file: {
    mean: 24.138,
    min: 23.844,
    max: 24.404,
    spread_percent: 2.32,
    observations: [23.844, 24.166, 24.404],
  },
  candidate_index_ms_per_file: {
    mean: 17.382,
    min: 17.136,
    max: 17.58,
    spread_percent: 2.55,
    observations: [17.136, 17.58, 17.431],
  },
  sample_saving_ms_per_file: 6.756,

  fingerprint_agreement: [
    {
      offered_files: 200,
      control_cpu_s: {
        mean: 9.15,
        min: 9.05,
        max: 9.25,
        spread_percent: 2.19,
        observations: [9.05, 9.25],
      },
      candidate_cpu_s: {
        mean: 7.24,
        min: 7.23,
        max: 7.26,
        spread_percent: 0.41,
        observations: [7.26, 7.23],
      },
      speedup: 1.26,
      identical: true,
    },
    {
      offered_files: 1200,
      control_cpu_s: {
        mean: 41.48,
        min: 41.44,
        max: 41.51,
        spread_percent: 0.17,
        observations: [41.44, 41.51],
      },
      candidate_cpu_s: {
        mean: 31.32,
        min: 31.31,
        max: 31.33,
        spread_percent: 0.06,
        observations: [31.31, 31.33],
      },
      speedup: 1.32,
      identical: true,
    },
    {
      offered_files: 8494,
      control_cpu_s: {
        mean: 299.9,
        min: 299.31,
        max: 300.48,
        spread_percent: 0.39,
        observations: [299.31, 300.48],
      },
      candidate_cpu_s: {
        mean: 226.24,
        min: 225.49,
        max: 226.98,
        spread_percent: 0.66,
        observations: [225.49, 226.98],
      },
      speedup: 1.33,
      identical: true,
    },
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

  query_compilation: {
    offered_files: 1200,
    dialects: ["typescript", "javascript"],
    compilations: 2,
    captures_calls_per_file: 1,
    parser_buffer_sizing:
      "Untouched. `project.ts` still grows one per-project buffer to twice the longest file's length, and the diff against the control commit touches neither `project.ts` nor `query_code_tree.ts` nor `native.ts`.",
  },
  type_name_equivalence:
    "The pinned name is compared against the binding's own accessor for every node of every sample file: 601,005 nodes over 200 files, 601,005 agreements, zero disagreements. Pinning per CLASS rather than per type id is NOT equivalent — 251,206 of those nodes disagree, because every anonymous token shares the base class — which is why each anonymous type id is given a class of its own.",
  capture_text_equivalence:
    "A capture's text sliced from the parsed source between its two Points is compared against `node.text` over every capture of every sample file: 212,870 captures, 212,870 agreements, zero disagreements. That is what says a Point's column counts the same units a JavaScript string index does; a test over source carrying combining marks, CJK identifiers and astral-plane literals guards it in the repository.",

  not_in_scope: [
    {
      what: "Answering the construct-target chain once per ancestor in the Python and Rust extractors too",
      measured:
        "Both carry the same walk, and neither appears in the crossing attribution for this corpus: the sample is TypeScript, and the JavaScript extractor's walk alone is 10.24% of the crossings that survive the type pin.",
      reason:
        "This epic books no change without a measurement to book it against. A memo added to a walk no measured corpus exercises is machinery whose cost is real and whose benefit is a guess.",
    },
    {
      what: "Hoisting `node.type` into a local at the remaining ~700 read sites",
      measured:
        "A type read costs 344 ns before the pin and a plain property load after it: `get type` is 42.91 CPU-seconds of the control corpus run and 0.00 of the candidate's.",
      reason:
        "The pin already removed the cost, so the rewrite would be 700 diff sites buying nothing measurable while putting a byte-identical fingerprint at three scales at risk. Where a function was being edited anyway the read is hoisted; elsewhere it is left alone.",
    },
    {
      what: "Bounding `extract_construct_target`'s walk instead of memoizing it",
      measured:
        "Capping its depth moves 403 of the 7,322 construct targets this corpus resolves — the reading TASK-381.13 recorded.",
      reason:
        "It changes the answer. The memo returns the same node the walk returns, which is what keeps this row's fingerprint claim available at all three scales.",
    },
  ],

  verdict:
    "A SPEEDUP, and the fingerprint says it is only that. Combined tree-sitter binding self-time over the whole corpus falls 184.87 s -> 121.45 s, a saving of 63.42 s, from four full-corpus `--cpu-prof` arms interleaved control,candidate,control,candidate; every control observation exceeds every candidate observation by at least 61.49 s. Unprofiled, the whole run falls 299.90 s -> 226.24 s (73.66 s, 1.33x, 8.672 ms/file). Accessor calls per indexed file fall 31,346.5 -> 11,096.8, a 64.60% fall over a 200-file size-stratified sample yielding the same 160,785 references and 8,338 scopes. All seven fingerprint components and both diagnostics hashes are identical at 200, 1,200 and 8,494 files, and identical to what this corpus already has on record in forward order.",

  note:
    "Four unprofiled full-corpus arms through `run_benchmark_arm` interleaved control,candidate,control,candidate, plus four profiled arms in the same session in the same order, one process each, forward order, at --max-old-space-size=15365; the control is a second worktree of this repository sharing the primary checkout's node_modules, so both arms resolve tree-sitter 0.25.0 and tree-sitter-typescript 0.23.2. " +
    "The profiled arms are NOT comparands for `corpus_arms`: a profiler costs this run about 40% more CPU (321.83 s against 299.31 s on one control arm), so the two families are only ever compared within themselves. " +
    "Binding self-time is the sum of self-time over every frame whose script is `tree-sitter/index.js`, taken from the V8 `.cpuprofile` at the default 1 ms sampling interval. " +
    "The crossing counts and the equivalence figures are properties of the corpus and travel between machines; the CPU and MB figures do not. " +
    "The sample under-predicts the corpus again, as it did for TASK-381.13: 6.756 ms/file over 200 size-stratified files against 8.672 measured over all 8,494. The corpus figure is the one quoted.",
};
