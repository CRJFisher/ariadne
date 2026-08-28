/**
 * What the reported call graph stopped depending on when an ImportDefinition
 * left the definition location index and one writer took over the
 * indirect-reachability map.
 *
 * This record carries three things a later reader cannot recover: the probe was
 * shown to MOVE on the tree immediately before the change, so its silence
 * afterwards means something; the converged answer is a strict improvement
 * rather than merely a stable one, proven by literal set difference over the
 * complete member lists; and the cost was taken from arms interleaved in the
 * same session, because absolute CPU does not transfer between sessions.
 *
 * The hashes here ARE comparable with a current digest — unlike
 * `RECORDED_ORDER_SENSITIVITY`, which was produced by a superseded algorithm —
 * because every one of them came from this harness's seven-component
 * fingerprint at schema version 3. What does not transfer is the CPU and RSS
 * beside them, which are properties of the box.
 */

interface ComponentDigest {
  readonly count: number;
  readonly hash: string;
}

type FingerprintDigests = Readonly<Record<string, ComponentDigest>>;

interface OrderArm {
  readonly ingest_order: string;
  readonly sequence_index: number;
  readonly cpu_seconds: number;
  readonly peak_rss_mb: number;
  readonly components: FingerprintDigests;
  /** The diagnostics payload as extraction emitted it. */
  readonly diag_hash: string;
  /** The same payload deep-sorted, so only a MEMBERSHIP difference moves it. */
  readonly canonical_hash: string;
}

interface SliceIdentity {
  readonly offered_files: number;
  readonly indexed: number;
  readonly dropped: number;
  readonly heap_cap_mb: number;
}

interface OrderIndependenceSlice extends SliceIdentity {
  readonly label: string;
  readonly seed: number;
  /**
   * Further mulberry32 seeds the same slice was run at, each reproducing
   * `agreed_components` exactly. One seed proves a shuffle agrees; a second
   * proves the first shuffle was not the one permutation that happened to.
   */
  readonly seeds_also_reproduced: readonly number[];
  readonly orders_compared: readonly string[];
  /** One digest set, asserted identical across every order below it. */
  readonly agreed_components: FingerprintDigests;
  readonly agreed_canonical_hash: string;
  readonly arms: readonly OrderArm[];
  /**
   * `diag_hash` differs across orders while `canonical_hash` holds. The
   * diagnostics payload's evidence lists are fed in whatever order built them,
   * which is an ordering difference inside a payload whose MEMBERSHIP is now a
   * function of the corpus. It is present on the tree before this change too,
   * so it is neither introduced nor removed here — TASK-381.2's surface.
   */
  readonly diag_hashes_by_order: Readonly<Record<string, string>>;
}

interface NonVacuityArm {
  readonly ingest_order: string;
  readonly components: FingerprintDigests;
  readonly canonical_hash: string;
}

interface NonVacuityProbe extends SliceIdentity {
  readonly label: string;
  readonly ariadne_commit: string;
  readonly arms: readonly NonVacuityArm[];
  /** Entry points whose MEMBERSHIP moved, counted in both directions. */
  readonly entry_points_only_in_first: number;
  readonly entry_points_only_in_second: number;
  readonly components_that_moved: readonly string[];
  readonly components_that_held: readonly string[];
}

interface SetDifference {
  readonly component: string;
  readonly before: number;
  readonly after: number;
  readonly only_before: number;
  readonly only_after: number;
}

interface SpotVerifiedRemoval {
  readonly entry_point: string;
  readonly called_from: string;
  readonly source_call_site: string;
}

interface ArmCost {
  readonly arm: string;
  readonly sequence_indices: readonly number[];
  readonly cpu_seconds: readonly number[];
  readonly peak_rss_mb: readonly number[];
}

interface FailureTaxonomy {
  readonly call_references: number;
  readonly resolved: number;
  readonly by_reason: Readonly<Record<string, number>>;
}

export interface RecordedOrderIndependence {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly tree_sitter_version: string;
  readonly session_id: string;
  /** The tree this change was made on top of; every "before" arm ran it. */
  readonly control_commit: string;
  readonly slices: readonly OrderIndependenceSlice[];
  readonly non_vacuity: readonly NonVacuityProbe[];
  readonly strict_improvement: readonly SetDifference[];
  readonly resolved_call_sites: { readonly before: number; readonly after: number };
  readonly call_edge_pairs_with_a_changed_count: number;
  readonly indirect_reachability_gained: readonly string[];
  readonly entry_points_removed: number;
  readonly entry_points_added: number;
  readonly spot_verified_removals: readonly SpotVerifiedRemoval[];
  readonly cost: readonly ArmCost[];
  readonly cost_ratio: number;
  readonly failure_taxonomy: {
    readonly before: FailureTaxonomy;
    readonly after: FailureTaxonomy;
  };
  readonly superseded: readonly { readonly claim: string; readonly reason: string }[];
}

const AGREED_FULL_CORPUS: FingerprintDigests = {
  nodes: { count: 201595, hash: "1dee6f73bd6b19b3" },
  call_edges: { count: 1077986, hash: "1ddc158820141bce" },
  unresolved_calls: { count: 420958, hash: "4783fb8da9030c81" },
  raw_entry_points: { count: 17563, hash: "81190da4a3cade3d" },
  indirect_reachability_keys: { count: 29378, hash: "bd658514f967310e" },
  dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
  indirect_reachability_evidence: { count: 29378, hash: "0d66eb1473576544" },
};

const AGREED_SLICE_1200: FingerprintDigests = {
  nodes: { count: 28057, hash: "d0a70789f48a4e2f" },
  call_edges: { count: 84346, hash: "b32e61fb8179dbcc" },
  unresolved_calls: { count: 62942, hash: "6cb76597cbe63c25" },
  raw_entry_points: { count: 4141, hash: "50307354dde86797" },
  indirect_reachability_keys: { count: 4450, hash: "7c25d1cf1ffc8c32" },
  dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
  indirect_reachability_evidence: { count: 4450, hash: "4540f71f3ad37723" },
};

export const RECORDED_ORDER_INDEPENDENCE: RecordedOrderIndependence = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  predicate: "src",
  discovered_files: 8494,
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  tree_sitter_version: "0.25.0",
  session_id: "task-381.11",
  control_commit: "7a7d99b0",

  slices: [
    {
      label: "every discovered file under src/",
      offered_files: 8494,
      indexed: 8494,
      dropped: 0,
      heap_cap_mb: 15365,
      seed: 7,
      seeds_also_reproduced: [],
      orders_compared: ["forward", "reversed", "descending_size", "shuffled"],
      agreed_components: AGREED_FULL_CORPUS,
      agreed_canonical_hash: "834cc16d32aef077",
      arms: [
        {
          ingest_order: "forward",
          sequence_index: 1,
          cpu_seconds: 353.2,
          peak_rss_mb: 7188.6,
          components: AGREED_FULL_CORPUS,
          diag_hash: "d08f8e814597b4bb",
          canonical_hash: "834cc16d32aef077",
        },
        {
          ingest_order: "reversed",
          sequence_index: 4,
          cpu_seconds: 349.9,
          peak_rss_mb: 6822.3,
          components: AGREED_FULL_CORPUS,
          diag_hash: "eac6dab0a10ead59",
          canonical_hash: "834cc16d32aef077",
        },
        {
          ingest_order: "descending_size",
          sequence_index: 5,
          cpu_seconds: 358.4,
          peak_rss_mb: 8577.6,
          components: AGREED_FULL_CORPUS,
          diag_hash: "aa5b160cebe5d19f",
          canonical_hash: "834cc16d32aef077",
        },
        {
          ingest_order: "shuffled",
          sequence_index: 6,
          cpu_seconds: 345.4,
          peak_rss_mb: 7544.7,
          components: AGREED_FULL_CORPUS,
          diag_hash: "d87325cd8d075a18",
          canonical_hash: "834cc16d32aef077",
        },
      ],
      diag_hashes_by_order: {
        forward: "d08f8e814597b4bb",
        reversed: "eac6dab0a10ead59",
        descending_size: "aa5b160cebe5d19f",
        shuffled: "d87325cd8d075a18",
      },
    },
    {
      label: "the first 1,200 path-sorted files of the same predicate",
      offered_files: 1200,
      indexed: 1200,
      dropped: 0,
      heap_cap_mb: 2648,
      seed: 7,
      seeds_also_reproduced: [13],
      orders_compared: ["forward", "reversed", "descending_size", "shuffled"],
      agreed_components: AGREED_SLICE_1200,
      agreed_canonical_hash: "b89fb63905853697",
      arms: [
        {
          ingest_order: "forward",
          sequence_index: 0,
          cpu_seconds: 45.9,
          peak_rss_mb: 1222.8,
          components: AGREED_SLICE_1200,
          diag_hash: "0571819adcc4b15a",
          canonical_hash: "b89fb63905853697",
        },
        {
          ingest_order: "reversed",
          sequence_index: 1,
          cpu_seconds: 47.3,
          peak_rss_mb: 1222.8,
          components: AGREED_SLICE_1200,
          diag_hash: "2531e8bf3a588e85",
          canonical_hash: "b89fb63905853697",
        },
        {
          ingest_order: "descending_size",
          sequence_index: 2,
          cpu_seconds: 47.1,
          peak_rss_mb: 1222.8,
          components: AGREED_SLICE_1200,
          diag_hash: "a59ac09d2b748796",
          canonical_hash: "b89fb63905853697",
        },
        {
          ingest_order: "shuffled",
          sequence_index: 3,
          cpu_seconds: 47.5,
          peak_rss_mb: 1222.8,
          components: AGREED_SLICE_1200,
          diag_hash: "8c849a507e1e750d",
          canonical_hash: "b89fb63905853697",
        },
      ],
      diag_hashes_by_order: {
        forward: "0571819adcc4b15a",
        reversed: "2531e8bf3a588e85",
        descending_size: "a59ac09d2b748796",
        shuffled: "8c849a507e1e750d",
      },
    },
  ],

  non_vacuity: [
    {
      label: "the same 8,494 files, forward against descending byte size",
      ariadne_commit: "7a7d99b0",
      offered_files: 8494,
      indexed: 8494,
      dropped: 0,
      heap_cap_mb: 15365,
      arms: [
        {
          ingest_order: "forward",
          canonical_hash: "07dd6824aa8a0713",
          components: {
            nodes: { count: 201595, hash: "1dee6f73bd6b19b3" },
            call_edges: { count: 1076088, hash: "9ebbb24c04c88952" },
            unresolved_calls: { count: 424057, hash: "bc249186fe32e982" },
            raw_entry_points: { count: 17647, hash: "4812efbaee47ef27" },
            indirect_reachability_keys: { count: 29375, hash: "f32e80ad5909e494" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 29375, hash: "81d3bb3c789f39a6" },
          },
        },
        {
          ingest_order: "descending_size",
          canonical_hash: "872d20a3b82b3452",
          components: {
            nodes: { count: 201595, hash: "1dee6f73bd6b19b3" },
            call_edges: { count: 1076137, hash: "3d67874d14d450c3" },
            unresolved_calls: { count: 424063, hash: "c0155e5401833b75" },
            raw_entry_points: { count: 17620, hash: "bf5f0271360d42fb" },
            indirect_reachability_keys: { count: 29375, hash: "f32e80ad5909e494" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 29375, hash: "e4d81e48eb2bfe23" },
          },
        },
      ],
      entry_points_only_in_first: 32,
      entry_points_only_in_second: 5,
      components_that_moved: [
        "call_edges",
        "unresolved_calls",
        "raw_entry_points",
        "indirect_reachability_evidence",
      ],
      components_that_held: [
        "nodes",
        "indirect_reachability_keys",
        "dropped_files",
      ],
    },
    {
      label: "the first 1,200 files, all four orders",
      ariadne_commit: "7a7d99b0",
      offered_files: 1200,
      indexed: 1200,
      dropped: 0,
      heap_cap_mb: 2648,
      arms: [
        {
          ingest_order: "forward",
          canonical_hash: "71b2cef0c2a8ab70",
          components: {
            nodes: { count: 28057, hash: "d0a70789f48a4e2f" },
            call_edges: { count: 84251, hash: "804e15d91d7d2e07" },
            unresolved_calls: { count: 63057, hash: "c164d2d111095a5e" },
            raw_entry_points: { count: 4163, hash: "c4d25e8fb5332d4e" },
            indirect_reachability_keys: { count: 4450, hash: "7c25d1cf1ffc8c32" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 4450, hash: "11fd97a4cbefa162" },
          },
        },
        {
          ingest_order: "reversed",
          canonical_hash: "3d0831c91009afaf",
          components: {
            nodes: { count: 28057, hash: "d0a70789f48a4e2f" },
            call_edges: { count: 84269, hash: "d06de666f3a5f1c5" },
            unresolved_calls: { count: 63039, hash: "ea699d51f1aa8e55" },
            raw_entry_points: { count: 4160, hash: "020585ad0a31cb1b" },
            indirect_reachability_keys: { count: 4450, hash: "7c25d1cf1ffc8c32" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 4450, hash: "96be7bc9afbde33e" },
          },
        },
        {
          ingest_order: "descending_size",
          canonical_hash: "567f339d97603e94",
          components: {
            nodes: { count: 28057, hash: "d0a70789f48a4e2f" },
            call_edges: { count: 84272, hash: "16ee02ac8025f270" },
            unresolved_calls: { count: 63027, hash: "97aea5f0dd4f7a1a" },
            raw_entry_points: { count: 4156, hash: "82a2ede6b8ed0b30" },
            indirect_reachability_keys: { count: 4450, hash: "7c25d1cf1ffc8c32" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 4450, hash: "93ecff6d27dfdf1e" },
          },
        },
        {
          ingest_order: "shuffled",
          canonical_hash: "943ee113f2ddfdbd",
          components: {
            nodes: { count: 28057, hash: "d0a70789f48a4e2f" },
            call_edges: { count: 84253, hash: "9065095faca0e2ca" },
            unresolved_calls: { count: 63052, hash: "f7b8dff833ed402e" },
            raw_entry_points: { count: 4162, hash: "8be7cd599d05b5bf" },
            indirect_reachability_keys: { count: 4450, hash: "7c25d1cf1ffc8c32" },
            dropped_files: { count: 0, hash: "e3b0c44298fc1c14" },
            indirect_reachability_evidence: { count: 4450, hash: "d9dd9218b6b6f562" },
          },
        },
      ],
      // Four orders, four different entry-point sets: 4,163 / 4,160 / 4,156 /
      // 4,162, union 4,168 against intersection 4,151, so 17 functions enter or
      // leave the report depending on the walk — 12 of them reported forward
      // and missing from at least one other order, 5 reported by some other
      // order and not forward. Pairwise against forward: reversed 8 out and 5
      // in, descending byte size 7 and 0, shuffled 2 and 1.
      entry_points_only_in_first: 12,
      entry_points_only_in_second: 5,
      components_that_moved: [
        "call_edges",
        "unresolved_calls",
        "raw_entry_points",
        "indirect_reachability_evidence",
      ],
      components_that_held: [
        "nodes",
        "indirect_reachability_keys",
        "dropped_files",
      ],
    },
  ],

  // Taken by literal set difference over the complete member lists of the two
  // forward arms, not from the counts: a component whose count falls by 84
  // could have lost 100 and gained 16.
  strict_improvement: [
    { component: "nodes", before: 201595, after: 201595, only_before: 0, only_after: 0 },
    { component: "raw_entry_points", before: 17647, after: 17563, only_before: 84, only_after: 0 },
    { component: "call_edges", before: 1076088, after: 1077986, only_before: 0, only_after: 1898 },
    { component: "unresolved_calls", before: 424057, after: 420958, only_before: 3099, only_after: 0 },
    { component: "indirect_reachability_keys", before: 29375, after: 29378, only_before: 0, only_after: 3 },
  ],
  resolved_call_sites: { before: 1291072, after: 1294238 },
  call_edge_pairs_with_a_changed_count: 98,
  indirect_reachability_gained: [
    "method:src/vs/platform/registry/common/platform.ts:36:9:36:11:add",
    "method:src/vs/platform/registry/common/platform.ts:44:9:44:13:knows",
    "method:src/vs/platform/registry/common/platform.ts:48:9:48:10:as",
  ],
  entry_points_removed: 84,
  entry_points_added: 0,
  spot_verified_removals: [
    {
      entry_point: "method:src/vs/base/common/ime.ts:15:13:15:19:enabled",
      called_from:
        "function:src/vs/editor/browser/controller/editContext/native/screenReaderContentSimple.ts:120:88:157:3:<anonymous>",
      source_call_site: "screenReaderContentSimple.ts:122 — `!IME.enabled`",
    },
    {
      entry_point: "method:src/vs/editor/browser/config/tabFocus.ts:14:9:14:23:getTabFocusMode",
      called_from:
        "method:src/vs/editor/browser/config/editorConfiguration.ts:116:10:116:24:_computeOptions",
      source_call_site: "editorConfiguration.ts:131 — `TabFocus.getTabFocusMode()`",
    },
    {
      entry_point: "method:src/vs/base/common/errors.ts:64:2:64:18:onUnexpectedError",
      called_from: "function:src/vs/base/common/errors.ts:107:17:107:33:onUnexpectedError",
      source_call_site: "errors.ts:107 — the free function delegating to the singleton",
    },
    {
      entry_point: "method:src/vs/platform/registry/common/platform.ts:48:9:48:10:as",
      called_from: "function:src/vs/platform/agentHost/common/agentHostConfigurationSync.ts:13:10:13:20:getRegistry",
      source_call_site: "514 distinct callers resolve onto it once the singleton binds",
    },
  ],

  // A,B,A,B in one session on one box, so the ratio between the two is
  // admissible. Both arms ran forward order over every discovered file.
  cost: [
    {
      arm: "before",
      sequence_indices: [0, 2],
      cpu_seconds: [338.8, 345.4],
      peak_rss_mb: [7371.4, 7432.4],
    },
    {
      arm: "after",
      sequence_indices: [1, 3],
      cpu_seconds: [353.2, 355.2],
      peak_rss_mb: [7188.6, 6924.6],
    },
  ],
  cost_ratio: 1.035,

  // Where the 4,941 call sites that stop bailing at `receiver_type_unknown`
  // end up: 3,108 resolve, and 1,842 reach member lookup and fail there
  // instead — 1,321 more `method_not_on_type` and 521 more
  // `member_type_unknown`. That is the work the +3.5% CPU buys.
  //
  // The two sides differ by 9 because the corpus carries 9 more call
  // references after the change (977,985 -> 977,994). Nine references is
  // inside the change's blast radius — a receiver that now has a type is a
  // receiver whose callbacks can be attributed — but which nine, and by which
  // path, was not established here and is not claimed.
  failure_taxonomy: {
    before: {
      call_references: 977985,
      resolved: 553928,
      by_reason: {
        name_not_in_scope: 165901,
        receiver_type_unknown: 163174,
        member_type_unknown: 59544,
        method_not_on_type: 23339,
        polymorphic_no_implementations: 5857,
        class_definition_not_found: 3273,
        collection_dispatch_miss: 2132,
        no_enclosing_class_scope: 396,
        constructor_target_not_a_class: 355,
        no_parent_class: 86,
      },
    },
    after: {
      call_references: 977994,
      resolved: 557036,
      by_reason: {
        name_not_in_scope: 165901,
        receiver_type_unknown: 158233,
        member_type_unknown: 60065,
        method_not_on_type: 24660,
        polymorphic_no_implementations: 5857,
        class_definition_not_found: 3273,
        collection_dispatch_miss: 2132,
        no_enclosing_class_scope: 396,
        constructor_target_not_a_class: 355,
        no_parent_class: 86,
      },
    },
  },

  superseded: [
    {
      claim:
        "`by_symbol` insertion order in `get_callable_definitions` decides which definition a name resolves to, so it needs an ordering rule and a tie-break.",
      reason:
        "Four ingest orders necessarily produce four different insertion orders and, after this change, one byte-identical fingerprint. The prototype that appeared to implicate it re-inserted only a file's imports, which changed which symbol won a shared location key.",
    },
    {
      claim:
        "State accumulated inside `resolve_type_metadata` or `extract_constructor_bindings` carries the sensitivity.",
      reason:
        "The sensitivity is created in Phase 2.5, before a single name is resolved. Resolution was faithfully reading a corrupted index.",
    },
    {
      claim:
        "A 180-file set with `resources.ts` at position 24 and at position 155 is the positional harness that pins the binding.",
      reason:
        "It demonstrated the symptom but not the stage. The binding is pinned by a declaration plus two importers in two orders, and by three files driven through `ingest_file` x N then `resolve_corpus`.",
    },
    {
      claim:
        "Full corpus costs 876,859 ms before and 920,248 ms after, at 3,537-5,679 and 5,502-5,914 MB peak RSS.",
      reason:
        "Those were the prototype's arms on a 4-core Darwin 21.6.0 box. Measured here on 6 cores over the landed stack: 342.1 s before, 354.2 s after, at 7,401.9 and 7,056.6 MB. Absolute CPU does not transfer between sessions or machines; only the same-session ratio does.",
    },
  ],
};
