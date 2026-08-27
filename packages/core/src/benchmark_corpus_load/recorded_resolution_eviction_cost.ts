/**
 * What eviction costs `ResolutionState`, measured when it started removing a
 * batch of files in one pass instead of one file at a time.
 *
 * A per-file eviction scans `scope_to_file` and copies every project-wide map
 * once per file, so removing a set costs one copy of the whole project per
 * member of the set. Both counterfactuals are counted here as entries scanned
 * and entries cloned, over one corpus in one arrival order — properties of the
 * algorithm, which is why they travel between machines while the CPU figures
 * beside them do not.
 *
 * The cold-load rows say where the cost is NOT. A corpus load evicts against a
 * state that holds nothing yet — the two-phase driver resolves once, after every
 * file is in the registries — so every one of its evictions removes nothing, and
 * the batched form allocates no clone for any of them. What the batching removes
 * from a cold load is the per-file loop itself: 1,200 calls become 56.
 *
 * The incremental row says where the cost IS. One edit to a file 252 others
 * reach evicted 252 times against a fully resolved project, scanning 11.3M
 * entries and cloning 28.5M. Batched, that edit scans and clones the project
 * once.
 *
 * The copy-on-write attribution is recorded so a profile alone cannot re-open
 * the question of making this state mutable. The share a full-corpus profile
 * gives the copy-on-write family belongs to the caller that evicts one file at a
 * time against a fully resolved project — the export-gate rollback path — and
 * not to bulk load, whose own applies clone an empty state.
 */

/** A count taken over one file set under both eviction shapes. */
interface PerFileVersusBatched {
  /** One `remove_file` per file, each scanning and cloning the project. */
  readonly per_file: number;
  /** One `remove_files` per batch. */
  readonly batched: number;
}

interface RecordedColdLoad {
  readonly file_count: number;
  readonly indexed: number;
  readonly dropped: number;
  /** Calls into the eviction path over the whole load. */
  readonly eviction_calls: PerFileVersusBatched;
  /** Files those calls evicted, summed — identical under both shapes. */
  readonly files_evicted: number;
  /** `scope_to_file` entries walked looking for the evicted files' scopes. */
  readonly scanned_entries: PerFileVersusBatched;
  /** Map entries copied to build the returned state. */
  readonly cloned_entries: PerFileVersusBatched;
  /** Maps allocated to hold those copies. */
  readonly clone_allocations: PerFileVersusBatched;
  /** Batched calls that removed nothing and returned the state they were given. */
  readonly identity_returns: number;
  /** Each of the seven components as `count/hash`, identical under both shapes. */
  readonly fingerprint: Readonly<Record<string, string>>;
  /** The entry-point diagnostics payload's pair of digests, also identical. */
  readonly diagnostics_hashes: readonly [string, string];
  /**
   * Total CPU for the arm, one process per shape. A single unreplicated run
   * each, so no ratio is taken from them: what this change buys at load scale is
   * allocation volume, and at these sizes the CPU difference is inside noise.
   */
  readonly arm_cpu_user_ms: PerFileVersusBatched;
}

interface RecordedEdit {
  /** The edited file, relative to the corpus root. */
  readonly file: string;
  /** Files re-resolved with it: itself plus everything its surface reaches. */
  readonly affected_files: number;
  readonly scanned_entries: PerFileVersusBatched;
  readonly cloned_entries: PerFileVersusBatched;
  /** CPU for this one `update_file`, one observation per shape, never a ratio. */
  readonly cpu_ms: PerFileVersusBatched;
}

interface RecordedIncrementalEdits {
  readonly file_count: number;
  readonly indexed: number;
  /**
   * How the edited files were chosen: the corpus's most-imported file, then a
   * stride through path order, so the sample holds both ends of the
   * affected-set range.
   */
  readonly selection: string;
  readonly edits: readonly RecordedEdit[];
  readonly total_scanned_entries: PerFileVersusBatched;
  readonly total_cloned_entries: PerFileVersusBatched;
  /** Calls into the eviction path across the four edits. */
  readonly eviction_calls: PerFileVersusBatched;
  /** Taken after the edits, identical under both shapes. */
  readonly fingerprint: Readonly<Record<string, string>>;
}

interface RecordedCopyOnWriteAttribution {
  /** The copy-on-write family's share of a full-corpus profile. */
  readonly profiled_share_of_run: string;
  readonly profiled_seconds: number;
  /** The stack that profile was taken on. */
  readonly profiled_stack: string;
  /** The two-phase corpus batch's own `ResolutionState` work in that profile. */
  readonly bulk_load_seconds: number;
  readonly bulk_load_share_of_run: string;
  /** The path the profiled cost belongs to, and the task that repairs it. */
  readonly owner: string;
  /** What the landed tree measures, at 1,200 files of `src`. */
  readonly applies_over_a_cold_load: number;
  readonly apply_cloned_entries_over_a_cold_load: number;
  readonly verdict: string;
}

export interface RecordedResolutionEvictionCost {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  /** Files the walk found; each size below is a prefix of this set. */
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly ingest_order: string;
  readonly seed: number;
  /**
   * The commit both shapes were measured over. Each arm is a working tree on
   * top of it that differs only in the eviction shape and in the counters.
   */
  readonly base_commit: string;
  readonly cold_load: readonly RecordedColdLoad[];
  readonly incremental: RecordedIncrementalEdits;
  readonly copy_on_write: RecordedCopyOnWriteAttribution;
  readonly note: string;
}

export const RECORDED_RESOLUTION_EVICTION_COST: RecordedResolutionEvictionCost =
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "src",
    discovered_files: 8494,
    machine: "Darwin 24.6.0 x64",
    node_version: "v22.22.1",
    cpu_count: 6,
    ingest_order: "forward",
    seed: 1,
    base_commit: "e20ecd23",

    cold_load: [
      {
        file_count: 200,
        indexed: 187,
        dropped: 13,
        eviction_calls: { per_file: 200, batched: 14 },
        files_evicted: 200,
        scanned_entries: { per_file: 0, batched: 0 },
        cloned_entries: { per_file: 0, batched: 0 },
        clone_allocations: { per_file: 1000, batched: 0 },
        identity_returns: 14,
        fingerprint: {
          nodes: "4647/ad14f2293f197b20",
          call_edges: "4836/3b9df93fbce5059c",
          unresolved_calls: "8840/a1ebcd53f4dc2af9",
          raw_entry_points: "1552/69759567d4cf1a2a",
          indirect_reachability_keys: "919/cc12e7d54f05663f",
          dropped_files: "13/08ea282f1850d164",
          indirect_reachability_evidence: "919/766157f8f5b51b32",
        },
        diagnostics_hashes: ["04ced1bb438d89c0", "72ea4e0e038437b1"],
        arm_cpu_user_ms: { per_file: 9836, batched: 9847.8 },
      },
      {
        file_count: 600,
        indexed: 572,
        dropped: 28,
        eviction_calls: { per_file: 600, batched: 29 },
        files_evicted: 600,
        scanned_entries: { per_file: 0, batched: 0 },
        cloned_entries: { per_file: 0, batched: 0 },
        clone_allocations: { per_file: 3000, batched: 0 },
        identity_returns: 29,
        fingerprint: {
          nodes: "13330/d741d2cca22283a9",
          call_edges: "18307/909a18fa234cd39e",
          unresolved_calls: "39237/6b7c9b06f007d271",
          raw_entry_points: "2123/304d0dc42d49fb4c",
          indirect_reachability_keys: "2148/6124af3d18cbca57",
          dropped_files: "28/f4ea1147f10c28da",
          indirect_reachability_evidence: "2148/e268242280bd4de5",
        },
        diagnostics_hashes: ["49c238d5c08c479c", "2a66385df442f223"],
        arm_cpu_user_ms: { per_file: 23975.5, batched: 24812.8 },
      },
      {
        file_count: 1200,
        indexed: 1145,
        dropped: 55,
        eviction_calls: { per_file: 1200, batched: 56 },
        files_evicted: 1200,
        scanned_entries: { per_file: 0, batched: 0 },
        cloned_entries: { per_file: 0, batched: 0 },
        clone_allocations: { per_file: 6000, batched: 0 },
        identity_returns: 56,
        fingerprint: {
          nodes: "26031/199a1740422ba703",
          call_edges: "39687/8d02390e59bef378",
          unresolved_calls: "69889/09d43b2536c4bb4c",
          raw_entry_points: "4059/e5df1eb41a38f99f",
          indirect_reachability_keys: "3832/21545a05a901da57",
          dropped_files: "55/7f902eb30c055b2e",
          indirect_reachability_evidence: "3832/597449c0089fa47c",
        },
        diagnostics_hashes: ["e2dd3ab2476b6a46", "d43142c326f57f57"],
        arm_cpu_user_ms: { per_file: 45691.5, batched: 44928 },
      },
    ],

    incremental: {
      file_count: 1200,
      indexed: 1145,
      selection:
        "The file with the most dependents, then every 287th file in path order.",
      edits: [
        {
          file: "src/vs/editor/common/core/range.ts",
          affected_files: 252,
          scanned_entries: { per_file: 11340237, batched: 54684 },
          cloned_entries: { per_file: 28545624, batched: 136729 },
          cpu_ms: { per_file: 7318, batched: 881 },
        },
        {
          file: "src/vs/base/parts/ipc/node/ipc.cp.ts",
          affected_files: 3,
          scanned_entries: { per_file: 163935, batched: 54684 },
          cloned_entries: { per_file: 409859, batched: 136729 },
          cpu_ms: { per_file: 235, batched: 192 },
        },
        {
          file: "src/vs/editor/browser/viewParts/margin/margin.ts",
          affected_files: 3,
          scanned_entries: { per_file: 163927, batched: 54684 },
          cloned_entries: { per_file: 409880, batched: 136729 },
          cpu_ms: { per_file: 158, batched: 106 },
        },
        {
          file: "src/vs/editor/contrib/codeAction/test/browser/codeActionKeybindingResolver.test.ts",
          affected_files: 1,
          scanned_entries: { per_file: 54684, batched: 54684 },
          cloned_entries: { per_file: 136729, batched: 136729 },
          cpu_ms: { per_file: 82, batched: 79 },
        },
      ],
      total_scanned_entries: { per_file: 11722783, batched: 218736 },
      total_cloned_entries: { per_file: 29502092, batched: 546916 },
      eviction_calls: { per_file: 259, batched: 4 },
      fingerprint: {
        nodes: "26031/199a1740422ba703",
        call_edges: "39687/8d02390e59bef378",
        unresolved_calls: "69889/09d43b2536c4bb4c",
        raw_entry_points: "4059/e5df1eb41a38f99f",
        indirect_reachability_keys: "3832/21545a05a901da57",
        dropped_files: "55/7f902eb30c055b2e",
        indirect_reachability_evidence: "3832/49b421d7263388fb",
      },
    },

    copy_on_write: {
      profiled_share_of_run: "27%",
      profiled_seconds: 211,
      profiled_stack:
        "The investigation's composed prototype stack over vscode's src/, before the export gate was keyed on (declaration space, name). A record of that profile, never a value to divide a later session's arm into.",
      bulk_load_seconds: 24,
      bulk_load_share_of_run: "2.9%",
      owner:
        "The export-gate rollback path, which calls Project.remove_file once per dropped file against a fully resolved project. TASK-381.8 removes the drops; TASK-381.7 re-measures the split on landed code at full corpus.",
      applies_over_a_cold_load: 2,
      apply_cloned_entries_over_a_cold_load: 0,
      verdict:
        "The copy-on-write contract is not what a full-corpus profile is pointing at. Over 1,200 files of src the landed bulk load makes two applies, both over a state that was empty when they cloned it, and its evictions allocate no clone at all. A mutable ResolutionState is justified only by a profile of a long-running incremental session — thousands of edits against a large state — which nobody has taken.",
    },

    note:
      "Both shapes run from working trees over the base commit, in the same session on one machine, forward order, seed 1. " +
      "The entry counts come from counters inside the eviction path: a scan is the size of `scope_to_file` at the moment the walk is taken, and a clone is the summed size of every map copied into the returned state. " +
      "They are exact and machine-independent. The CPU figures beside them are single observations of one process each and no ratio is taken from them. " +
      "The seven fingerprint components and both diagnostics digests are identical under the two shapes at every size, and identical again after the four edits, which is what says the two shapes describe the same call graph.",
  };
