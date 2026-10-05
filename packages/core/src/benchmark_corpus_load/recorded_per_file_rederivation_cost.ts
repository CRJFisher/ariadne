/**
 * What a file costs to index once the per-file passes stop re-deriving what
 * they already hold.
 *
 * Three re-derivations shared one cause and are removed together. Scope
 * containment was answered by reading every scope in the file, on 1,099.5
 * lookups per file, when the containment tree the answer lives in had already
 * been built; enum membership was answered by allocating the member list of a
 * 10-value and a 40-value enum on every one of ~1,185 captures per file; and
 * `node_to_location` crossed into the tree-sitter binding twice per position
 * to read the same Point twice.
 *
 * The measurement that matters is `corpus_arms`. `sample_arms` prices one file
 * and `components` prices each change on its own, but this epic's own rule is
 * that a per-file figure multiplied by a file count is not a corpus figure —
 * the parser-buffer high-water mark, estimated at 0.39-0.41 ms/file from a
 * sample of this kind, measured 0.008% of a corpus run. Here the sample
 * under-predicted rather than over-predicted: 4.071 ms/file over the sample
 * against **5.855 ms/file** measured over all 8,494 files.
 *
 * `warm_repeat_caution` is why the sample is a single pass. Measuring the same
 * 160 files three times in one process reads the saving as 2.524 ms/file — 38%
 * low — because a repeated pass prices a JIT that a load never has. A sample
 * arm passes over each file exactly once, which is what a load does.
 *
 * `descent_equivalence` is what licenses the change. A descent from
 * `root_scope_id` through `child_ids` and the scan it replaces are the same
 * function only while the scope tree's links agree with its geometry, so the
 * scan is kept as an oracle and both are run over every capture location in
 * the sample: 189,602 lookups, 189,602 agreements, zero disagreements, and
 * zero locations where two scopes at one depth both contained the location.
 *
 * `deleted_test` records the one concession. `not_in_scope` records the
 * neighbouring change this batch refuses and why.
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

/** One full-corpus process: one checkout, one whole-corpus load and trace. */
interface RecordedCorpusArm {
  readonly arm: "control" | "candidate";
  /** Position in the interleaved sequence, so the reader can see the A,B,A,B. */
  readonly sequence_index: number;
  /** Discovery, load and trace, cpu_user + cpu_system. */
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

/**
 * One of the three re-derivations, priced on its own.
 *
 * A component figure is a loop around one function with its inputs hot, so it
 * is a shape rather than a budget: the three sum to more than the sample arms
 * measure end to end when hot, and to less when cold. `corpus_arms` is the
 * budget.
 */
interface RecordedComponent {
  readonly what: string;
  readonly unit: string;
  readonly control: number;
  readonly candidate: number;
  readonly saving: number;
  /** The figure this step was written against, as the prototype probe stated it. */
  readonly prototype: string;
  readonly method: string;
}

/** The scan, kept as an oracle, against the descent that replaces it. */
interface RecordedDescentEquivalence {
  readonly files: number;
  readonly scopes: number;
  readonly lookups: number;
  readonly agreements: number;
  readonly disagreements: number;
  /**
   * Locations two scopes at one depth both contain — what the removed
   * `Malformed scope tree` throw reported. Zero over the whole sample.
   */
  readonly scan_ties: number;
  /** `get_scope_id` calls one real index of one file makes, counted in situ. */
  readonly get_scope_id_calls_per_file: number;
  readonly method: string;
}

/** One corpus size at which the two trees are asked whether they agree. */
interface RecordedFingerprintAgreement {
  readonly offered_files: number;
  readonly control_cpu_s: RecordedSpread;
  readonly candidate_cpu_s: RecordedSpread;
  readonly speedup: number;
  readonly identical: boolean;
}

/** The test this change makes unwitnessable, and why it goes. */
interface RecordedDeletedTest {
  readonly file: string;
  readonly name: string;
  readonly reason: string;
}

/** A neighbouring change this batch refuses, with the reading that refuses it. */
interface RecordedExclusion {
  readonly what: string;
  readonly measured: string;
  readonly reason: string;
}

export interface RecordedPerFileRederivationCost {
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
  /** The tree this step's control arms measure: the epic's stack through TASK-381.15. */
  readonly control_commit: string;
  /** The tree its candidate arms measure. */
  readonly candidate_commit: string;
  readonly heap_ceiling_mb: number;

  readonly corpus_arms: readonly RecordedCorpusArm[];
  readonly control_run_cpu_s: RecordedSpread;
  readonly candidate_run_cpu_s: RecordedSpread;
  /** Control mean minus candidate mean. Positive is a saving. */
  readonly corpus_saving_s: number;
  readonly corpus_saving_ms_per_file: number;
  readonly corpus_speedup: number;

  /** How the 160 files were chosen, and what distribution they carry. */
  readonly sample_construction: string;
  readonly sample_files: number;
  readonly sample_mean_bytes: number;
  readonly corpus_mean_bytes: number;
  readonly sample_arms: readonly RecordedSampleArm[];
  readonly control_index_ms_per_file: RecordedSpread;
  readonly candidate_index_ms_per_file: RecordedSpread;
  readonly sample_saving_ms_per_file: number;
  readonly sample_parse_and_index_saving_ms_per_file: number;
  /** References the sample yields under both trees — the same number. */
  readonly sample_references: number;

  readonly components: readonly RecordedComponent[];
  readonly captures_per_file: number;
  readonly warm_repeat_caution: string;

  readonly descent_equivalence: RecordedDescentEquivalence;
  readonly deleted_test: RecordedDeletedTest;

  readonly fingerprint_agreement: readonly RecordedFingerprintAgreement[];
  /** The seven components, identical under both trees at the full corpus. */
  readonly full_corpus_fingerprint: Readonly<Record<string, string>>;
  /** The payload as emitted — membership and evidence-list order. Identical. */
  readonly diag_hash: string;
  /** The deep-sorted payload — membership alone. Identical. */
  readonly canonical_hash: string;

  readonly not_in_scope: readonly RecordedExclusion[];
  readonly verdict: string;
  readonly note: string;
}

export const RECORDED_PER_FILE_REDERIVATION_COST: RecordedPerFileRederivationCost =
  {
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
    control_commit: "65e9c387",
    candidate_commit: "cdad9682",
    heap_ceiling_mb: 15365,

    corpus_arms: [
      {
        arm: "control",
        sequence_index: 0,
        run_cpu_s: 343.46,
        wall_s: 333.27,
        cpu_per_wall: 1.03,
        peak_rss_mb: 8398.6,
        loadavg_at_start: 7.6,
      },
      {
        arm: "candidate",
        sequence_index: 1,
        run_cpu_s: 301.03,
        wall_s: 285.64,
        cpu_per_wall: 1.05,
        peak_rss_mb: 8338.1,
        loadavg_at_start: 4.4,
      },
      {
        arm: "control",
        sequence_index: 2,
        run_cpu_s: 356.94,
        wall_s: 340.22,
        cpu_per_wall: 1.05,
        peak_rss_mb: 7419.1,
        loadavg_at_start: 4.0,
      },
      {
        arm: "candidate",
        sequence_index: 3,
        run_cpu_s: 301.12,
        wall_s: 284.23,
        cpu_per_wall: 1.06,
        peak_rss_mb: 7805.6,
        loadavg_at_start: 4.6,
      },
      {
        arm: "control",
        sequence_index: 4,
        run_cpu_s: 352.63,
        wall_s: 335.16,
        cpu_per_wall: 1.05,
        peak_rss_mb: 7562.9,
        loadavg_at_start: 4.6,
      },
      {
        arm: "candidate",
        sequence_index: 5,
        run_cpu_s: 301.67,
        wall_s: 286.18,
        cpu_per_wall: 1.05,
        peak_rss_mb: 7675.0,
        loadavg_at_start: 4.4,
      },
    ],

    control_run_cpu_s: {
      mean: 351.01,
      min: 343.46,
      max: 356.94,
      spread_percent: 3.84,
      observations: [343.46, 356.94, 352.63],
    },
    candidate_run_cpu_s: {
      mean: 301.27,
      min: 301.03,
      max: 301.67,
      spread_percent: 0.21,
      observations: [301.03, 301.12, 301.67],
    },
    corpus_saving_s: 49.74,
    corpus_saving_ms_per_file: 5.855,
    corpus_speedup: 1.17,

    sample_construction:
      "The 8,494 discovered files sorted by byte size, cut into eight equal-count strata, 20 files taken at even positions inside each. The sample's mean, median and 90th percentile track the corpus to within 4.2%, 0.9% and 1.9%; only its maximum cannot, because one 1,377,561-byte file is 0.01% of the corpus and no 160-file sample of this construction reaches it.",
    sample_files: 160,
    sample_mean_bytes: 12403,
    corpus_mean_bytes: 12944,

    sample_arms: [
      {
        arm: "control",
        sequence_index: 0,
        index_ms_per_file: 35.801,
        parse_and_index_ms_per_file: 37.447,
      },
      {
        arm: "candidate",
        sequence_index: 1,
        index_ms_per_file: 31.872,
        parse_and_index_ms_per_file: 33.547,
      },
      {
        arm: "control",
        sequence_index: 2,
        index_ms_per_file: 35.965,
        parse_and_index_ms_per_file: 37.63,
      },
      {
        arm: "candidate",
        sequence_index: 3,
        index_ms_per_file: 31.799,
        parse_and_index_ms_per_file: 33.415,
      },
      {
        arm: "control",
        sequence_index: 4,
        index_ms_per_file: 35.96,
        parse_and_index_ms_per_file: 37.637,
      },
      {
        arm: "candidate",
        sequence_index: 5,
        index_ms_per_file: 31.972,
        parse_and_index_ms_per_file: 33.581,
      },
      {
        arm: "control",
        sequence_index: 6,
        index_ms_per_file: 35.605,
        parse_and_index_ms_per_file: 37.276,
      },
      {
        arm: "candidate",
        sequence_index: 7,
        index_ms_per_file: 31.403,
        parse_and_index_ms_per_file: 33.005,
      },
    ],

    control_index_ms_per_file: {
      mean: 35.833,
      min: 35.605,
      max: 35.965,
      spread_percent: 1.0,
      observations: [35.801, 35.965, 35.96, 35.605],
    },
    candidate_index_ms_per_file: {
      mean: 31.762,
      min: 31.403,
      max: 31.972,
      spread_percent: 1.79,
      observations: [31.872, 31.799, 31.972, 31.403],
    },
    sample_saving_ms_per_file: 4.071,
    sample_parse_and_index_saving_ms_per_file: 4.111,
    sample_references: 144671,

    components: [
      {
        what: "scope containment, over every capture location in the sample",
        unit: "ms/file",
        control: 2.928,
        candidate: 0.89,
        saving: 2.038,
        prototype: "3.145 to 0.867 ms/file",
        method:
          "Two processes per arm, three reps each, interleaved control,candidate,control,candidate. Each rep calls the tree's own `get_scope_id` once per capture location — 189,602 of them — over contexts built ahead of the timer.",
      },
      {
        what: "capture normalisation: enum membership and the two Points",
        unit: "us/capture",
        control: 3.052,
        candidate: 1.74,
        saving: 1.313,
        prototype: "1.76 us/capture removed",
        method:
          "The loop is inline in `build_index_single_file` and neither tree exposes it, so both forms are replayed over the same 189,602 captures in one process, five reps, three processes: 1.287, 1.366 and 1.285 us/capture saved. At 1,185.0 captures per file that is 1.556 ms/file.",
      },
    ],
    captures_per_file: 1185.0,

    warm_repeat_caution:
      "A sample arm passes over each file ONCE. Indexing the same 160 files three times in one process — the obvious way to get a spread — reads the saving as 2.524 ms/file (31.530 against 29.006) because by the third pass the JIT has specialised code a load meets cold exactly once. That is 38% below the single-pass figure and 57% below what the corpus measured. Repetition is not free here, and a figure taken that way is a lower bound on a lower bound.",

    descent_equivalence: {
      files: 160,
      scopes: 6940,
      lookups: 189602,
      agreements: 189602,
      disagreements: 0,
      scan_ties: 0,
      get_scope_id_calls_per_file: 1099.5,
      method:
        "The scan is reimplemented in the probe as the oracle — deepest containing scope by precomputed depth, root when nothing contains the location — and run beside the tree's own descent over every capture location in the sample. The call count comes from a separate throwaway worktree of the candidate commit with a counter in `get_scope_id`: 175,920 calls over 160 files, none of it committed.",
    },

    deleted_test: {
      file: "packages/core/src/index_single_file/scopes/scopes.test.ts",
      name: "should throw error when multiple scopes at same depth contain location",
      reason:
        "It constructed two sibling depth-0 module scopes, both containing one location and neither reachable from the other, and asserted `Malformed scope tree`. A descent visits only what `root_scope_id` reaches through `child_ids`, so the second scope is never seen and the condition cannot be reported: the descent is provably NOT equivalent to the scan on that input, and this is the one place the two differ. The invariant is unwitnessable rather than merely unwitnessed, so the test goes with the throw. The other 51 tests in the file are unmodified and green, and the file's diff for this change is 59 deletions and 0 insertions.",
    },

    fingerprint_agreement: [
      {
        offered_files: 200,
        control_cpu_s: {
          mean: 10.45,
          min: 10.4,
          max: 10.51,
          spread_percent: 1.0,
          observations: [10.4, 10.51],
        },
        candidate_cpu_s: {
          mean: 8.94,
          min: 8.9,
          max: 8.99,
          spread_percent: 1.02,
          observations: [8.9, 8.99],
        },
        speedup: 1.17,
        identical: true,
      },
      {
        offered_files: 1200,
        control_cpu_s: {
          mean: 46.91,
          min: 46.78,
          max: 47.05,
          spread_percent: 0.57,
          observations: [46.78, 47.05],
        },
        candidate_cpu_s: {
          mean: 41.76,
          min: 41.18,
          max: 42.34,
          spread_percent: 2.77,
          observations: [41.18, 42.34],
        },
        speedup: 1.12,
        identical: true,
      },
      {
        offered_files: 8494,
        control_cpu_s: {
          mean: 351.01,
          min: 343.46,
          max: 356.94,
          spread_percent: 3.84,
          observations: [343.46, 356.94, 352.63],
        },
        candidate_cpu_s: {
          mean: 301.27,
          min: 301.03,
          max: 301.67,
          spread_percent: 0.21,
          observations: [301.03, 301.12, 301.67],
        },
        speedup: 1.17,
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

    not_in_scope: [
      {
        what: "Bounding `extract_construct_target`'s parent-chain walk",
        measured:
          "403 of 7,322 resolved construct targets move — the harness row TASK-381.13 was written against, and the only figure this step carries that it did not re-measure.",
        reason:
          "It changes the answer. Every other change in this batch is judged by a byte-identical fingerprint at 200, 1,200 and 8,494 files, and a change that moves 5.5% of resolved construct targets destroys that reading for all of them. It belongs in a step that can account for each moved target.",
      },
    ],

    verdict:
      "A SPEEDUP, and the fingerprint says it is only that. 351.01 s of CPU falls to 301.27 s over all 8,494 files — 49.74 s, 1.17x, 5.855 ms/file — with the candidate arm's three observations spreading 0.21% and the control's 3.84%. All seven fingerprint components and both diagnostics hashes are identical at 200, 1,200 and 8,494 files, so nothing the pipeline reports moves. The sample under-predicts the corpus for once: 4.071 ms/file over 160 size-stratified files against 5.855 measured, which is the opposite direction from the parser-buffer estimate this epic keeps as its warning, and is still a reason to take the corpus figure rather than the sample's.",

    note:
      "Six full-corpus arms interleaved control,candidate,control,candidate,control,candidate, one process each, forward order, at --max-old-space-size=15365; the control is a second worktree of this repository sharing the primary checkout's node_modules, so both arms resolve tree-sitter 0.25.0 and tree-sitter-typescript 0.23.2. " +
      "Every CPU figure is a `process.cpuUsage()` delta taken in a process with no profiler attached. The corpus arms come from `run_benchmark_arm`, so the fingerprint claim rests on the committed instrument; the sample and component arms come from probes outside the repository that import the checkout under test, so the same probe measures both arms and no difference between them can come from the harness. " +
      "The 200- and 1,200-file rows are two processes per arm through `--interleave`, which sizes its own children; the 8,494-file row is three per arm. " +
      "Peak RSS is reported per arm and carries no claim: it is taken at a 15,365 MB ceiling, which is not the 6,144 MB the memory contract is stated at, and peak RSS follows the ceiling the collector is given. " +
      "Lookup agreement, tie count, calls per file, captures per file and the fingerprint are properties of the corpus and travel between machines; the CPU and MB figures do not.",
  };
