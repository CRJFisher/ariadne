/**
 * What the two-phase corpus pass measured when the bulk load stopped replaying
 * the single-file edit API.
 *
 * A corpus load drove `Project.update_file` once per file. That is the file
 * watcher's API: it unions the file with its dependents and re-runs registry
 * eviction and Phases 3-5 for the whole set, so every arrival re-resolved every
 * already-loaded importer against a corpus that was still incomplete. Driving
 * `ingest_file` per file and then `resolve_corpus()` once asks each cross-file
 * question exactly once, against the whole corpus.
 *
 * Four claims are recorded here because each is a property of the algorithm and
 * travels between machines: how many times name resolution runs, how much heap
 * the load holds, how many imports end up pointing at a declaration, and which
 * callables stop being reported as unreachable. The fifth — the CPU ratio the
 * reverse indices buy on top of this driver — does NOT travel, and is recorded
 * with its session, its interleaved control arm and its machine so it is never
 * divided into another session's number.
 *
 * The sixth is the honest cost. This driver changes resolution behaviour: it
 * loses call edges the per-arrival driver resolved. Most of those the
 * per-arrival driver only resolved under some ingest orders, which makes them
 * instances of a resolver order-dependence that predates this change. The rest
 * — recorded below as `stable_on_unpatched` — the per-arrival driver resolved
 * under all three named orders, and this driver loses them. Every one reaches a
 * method on an exported singleton (`export const IME = new IMEImpl()` and its
 * kind), which is the constructor-binding defect TASK-381.11 owns and states
 * against this driver by name. None is a re-target: the call site stops
 * resolving rather than resolving elsewhere.
 */

/** A count taken before and after the driver changed, over one file set. */
interface BeforeAfter {
  readonly before: number;
  readonly after: number;
}

interface RecordedResolveNamesCollapse {
  readonly predicate: string;
  readonly file_count: number;
  readonly indexed: number;
  readonly dropped: number;
  /** Calls to `ResolutionRegistry.resolve_names` over the whole load. */
  readonly calls: BeforeAfter;
  /** Files handed to those calls, summed — the work the call count multiplies. */
  readonly files_resolved: BeforeAfter;
  /** Peak V8 used-heap over the load, MB. */
  readonly peak_heap_mb: BeforeAfter;
}

interface RecordedImportLocationRepair {
  readonly predicate: string;
  readonly file_count: number;
  /** Imports whose resolved target is itself an indexed file. */
  readonly in_corpus_imports: number;
  /** Of those, the ones whose `ImportDefinition` still names the importing file. */
  readonly still_on_the_import_statement: BeforeAfter;
  /**
   * The floor inside that residue: a wildcard edge names no single definition,
   * and a name the source file does not export has no declaration to point at.
   * Both keep the importing-file location by design.
   */
  readonly wildcard_edges: number;
  readonly name_absent_from_source_exports: number;
  /** The residue that had a declaration to point at and did not point at it. */
  readonly repairable: BeforeAfter;
}

interface RecordedFalseEntryPoint {
  readonly symbol: string;
  readonly path_line: string;
}

interface RecordedUnreachableRepair {
  readonly predicate: string;
  readonly file_count: number;
  readonly indexed: number;
  readonly raw_entry_points: BeforeAfter;
  /** Identical in both arms: no callable left the graph, only its caller was found. */
  readonly nodes: number;
  /**
   * Every entry point that disappeared, named by symbol and `path:line`. The
   * eager driver's cascade followed import edges, so a resolution dependency
   * that is not an import edge was never followed.
   */
  readonly false_entry_points_removed: readonly RecordedFalseEntryPoint[];
  readonly entry_points_added: number;
}

interface RecordedArm {
  readonly ariadne_commit: string;
  /** Total CPU seconds per repetition, in interleaved sequence order. */
  readonly cpu_seconds: readonly number[];
  /** The user half of it, recorded separately: system time is I/O, not work. */
  readonly cpu_user_ms: readonly number[];
  /** Near 1.0 on an idle box, far below it under contention. */
  readonly cpu_per_wall: readonly number[];
  readonly loadavg_at_start: readonly number[];
  readonly peak_rss_mb: readonly number[];
}

interface RecordedIndexRatio {
  readonly file_count: number;
  readonly indexed: number;
  readonly dropped: number;
  /** The session both arms ran in. A ratio never leaves it. */
  readonly session_id: string;
  /** This driver on a tree WITHOUT TASK-381.3's `DefinitionRegistry` reverse indices. */
  readonly control: RecordedArm;
  /** The same driver with them. */
  readonly candidate: RecordedArm;
  readonly speedup: number;
  /** Each of the seven components as `count/hash`, identical in both arms. */
  readonly fingerprint: Readonly<Record<string, string>>;
  readonly diagnostics_hashes: readonly [string, string];
}

interface RecordedEdgeLoss {
  readonly ingest_order: string;
  readonly control_edges: number;
  readonly candidate_edges: number;
  readonly gained: number;
  readonly lost: number;
  /**
   * Of the lost edges, those the per-arrival driver itself failed to resolve
   * under at least one of forward, reversed and shuffled — pre-existing
   * order-dependence rather than a loss this driver made.
   */
  readonly order_dependent_on_unpatched: number;
  /** Those the per-arrival driver resolved under all three named orders. */
  readonly stable_on_unpatched: number;
  /** Of the stable losses, those whose call site now resolves elsewhere. */
  readonly retargeted: number;
  /** Of the stable losses, those whose call site no longer resolves at all. */
  readonly now_unresolved: number;
  /** The remainder: no edge and no unresolved record, the caller having moved. */
  readonly no_unresolved_record: number;
  /** `file:member` of every callee a stable loss used to reach, with its count. */
  readonly stable_loss_callees: Readonly<Record<string, number>>;
}

export interface RecordedCorpusPassCost {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly ingest_order: string;
  readonly seed: number;
  /** The tree measured as "before": the per-arrival driver, immediately prior. */
  readonly unpatched_commit: string;
  readonly patched_commit: string;
  readonly resolve_names: readonly RecordedResolveNamesCollapse[];
  /** Why the count is 1 and not 0, and why it is not more. */
  readonly resolve_names_reason: string;
  readonly import_locations: readonly RecordedImportLocationRepair[];
  readonly unreachable_repair: RecordedUnreachableRepair;
  readonly reverse_index_ratio: readonly RecordedIndexRatio[];
  readonly edge_losses: readonly RecordedEdgeLoss[];
  readonly edge_loss_verdict: string;
}

export const RECORDED_CORPUS_PASS_COST: RecordedCorpusPassCost = {
  corpus: "microsoft/vscode",
  corpus_commit: "f3fa55c3",
  machine: "Darwin 24.6.0 x64",
  node_version: "v22.22.1",
  cpu_count: 6,
  ingest_order: "forward",
  seed: 1,
  unpatched_commit: "39f6c190",
  patched_commit: "b1051ae5",

  resolve_names: [
    {
      predicate: "folder-ts:src/vs/base",
      file_count: 100,
      indexed: 97,
      dropped: 3,
      calls: { before: 100, after: 1 },
      files_resolved: { before: 189, after: 97 },
      peak_heap_mb: { before: 129.2, after: 101.4 },
    },
    {
      predicate: "src",
      file_count: 200,
      indexed: 187,
      dropped: 13,
      calls: { before: 197, after: 1 },
      files_resolved: { before: 618, after: 187 },
      peak_heap_mb: { before: 385.7, after: 181.2 },
    },
    {
      predicate: "src",
      file_count: 1200,
      indexed: 1145,
      dropped: 55,
      calls: { before: 1183, after: 1 },
      files_resolved: { before: 3549, after: 1145 },
      peak_heap_mb: { before: 2032, after: 645.1 },
    },
  ],
  resolve_names_reason:
    "Exactly one call at every size: `resolve_corpus` resolves the whole corpus in a single pass. " +
    "A file whose ingest throws is rolled back through `evict_ingested_file`, which drops it from the registries without re-resolving, " +
    "so the 3, 13 and 55 dropped files add nothing to the count. Routing that rollback through `remove_file` instead would add one call per " +
    "dropped file that still had an ingested dependent, and that work would be spent resolving an incomplete corpus that pass B resolves again.",

  import_locations: [
    {
      predicate: "folder-ts:src/vs/base",
      file_count: 100,
      in_corpus_imports: 524,
      still_on_the_import_statement: { before: 131, after: 0 },
      wildcard_edges: 0,
      name_absent_from_source_exports: 0,
      repairable: { before: 131, after: 0 },
    },
    {
      predicate: "src",
      file_count: 200,
      in_corpus_imports: 963,
      still_on_the_import_statement: { before: 494, after: 16 },
      wildcard_edges: 0,
      name_absent_from_source_exports: 16,
      repairable: { before: 478, after: 0 },
    },
    {
      predicate: "src",
      file_count: 1200,
      in_corpus_imports: 9914,
      still_on_the_import_statement: { before: 3528, after: 471 },
      wildcard_edges: 1,
      name_absent_from_source_exports: 470,
      repairable: { before: 3057, after: 0 },
    },
  ],

  unreachable_repair: {
    predicate: "folder-ts:src/vs/base",
    file_count: 100,
    indexed: 97,
    raw_entry_points: { before: 1076, after: 1073 },
    nodes: 3203,
    false_entry_points_removed: [
      {
        symbol: "ToggleActionViewItem.focus",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:106",
      },
      {
        symbol: "ToggleActionViewItem.blur",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:111",
      },
      {
        symbol: "CheckboxActionViewItem.blur",
        path_line: "src/vs/base/browser/ui/toggle/toggle.ts:516",
      },
    ],
    entry_points_added: 0,
  },

  reverse_index_ratio: [
    {
      file_count: 600,
      indexed: 572,
      dropped: 28,
      session_id: "ac7-n600",
      control: {
        ariadne_commit: "5e223ffd",
        cpu_seconds: [33.72, 33.72],
        cpu_user_ms: [32848.2, 32838.8],
        cpu_per_wall: [1.08, 1.07],
        loadavg_at_start: [3.8, 3],
        peak_rss_mb: [676.8, 631.6],
      },
      candidate: {
        ariadne_commit: "b1051ae5",
        cpu_seconds: [24.74, 24.84],
        cpu_user_ms: [23922.3, 24052.6],
        cpu_per_wall: [1.11, 1.1],
        loadavg_at_start: [3.2, 3.2],
        peak_rss_mb: [721.8, 677],
      },
      speedup: 1.36,
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
    },
    {
      file_count: 1200,
      indexed: 1145,
      dropped: 55,
      session_id: "ac7-n1200",
      control: {
        ariadne_commit: "5e223ffd",
        cpu_seconds: [93.97, 93.87],
        cpu_user_ms: [92163.4, 91975.8],
        cpu_per_wall: [1.02, 1.01],
        loadavg_at_start: [2.8, 3.9],
        peak_rss_mb: [1150.7, 1146.4],
      },
      candidate: {
        ariadne_commit: "b1051ae5",
        cpu_seconds: [46.41, 46.02],
        cpu_user_ms: [45005.8, 44528.8],
        cpu_per_wall: [1.03, 1.08],
        loadavg_at_start: [3.2, 2.7],
        peak_rss_mb: [1254.1, 1212.8],
      },
      speedup: 2.03,
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
    },
  ],

  edge_losses: [
    {
      ingest_order: "forward",
      control_edges: 39071,
      candidate_edges: 39687,
      gained: 693,
      lost: 77,
      order_dependent_on_unpatched: 55,
      stable_on_unpatched: 22,
      retargeted: 0,
      now_unresolved: 18,
      no_unresolved_record: 4,
      stable_loss_callees: {
        "src/vs/base/common/errors.ts:getUnexpectedErrorHandler": 4,
        "src/vs/base/common/ime.ts:enabled": 4,
        "src/vs/base/common/errors.ts:onUnexpectedError": 2,
        "src/vs/base/common/errors.ts:setUnexpectedErrorHandler": 2,
        "src/vs/base/common/ime.ts:onDidChange": 2,
        "src/vs/editor/common/languages/modesRegistry.ts:registerLanguage": 2,
        "src/vs/base/common/idGenerator.ts:nextId": 2,
        "src/vs/base/common/errors.ts:onUnexpectedExternalError": 1,
        "src/vs/base/parts/ipc/electron-main/ipcMain.ts:on": 1,
        "src/vs/editor/common/languages/modesRegistry.ts:getLanguages": 1,
        "src/vs/editor/common/languages/modesRegistry.ts:onDidChangeLanguages": 1,
      },
    },
    {
      ingest_order: "reversed",
      control_edges: 39733,
      candidate_edges: 39707,
      gained: 17,
      lost: 43,
      order_dependent_on_unpatched: 39,
      stable_on_unpatched: 4,
      retargeted: 0,
      now_unresolved: 4,
      no_unresolved_record: 0,
      stable_loss_callees: {
        "src/vs/base/common/idGenerator.ts:nextId": 2,
        "src/vs/base/parts/ipc/electron-main/ipcMain.ts:on": 1,
        "src/vs/editor/common/inputMode.ts:getInputMode": 1,
      },
    },
    {
      ingest_order: "descending_size",
      control_edges: 39653,
      candidate_edges: 39706,
      gained: 74,
      lost: 21,
      order_dependent_on_unpatched: 11,
      stable_on_unpatched: 10,
      retargeted: 0,
      now_unresolved: 10,
      no_unresolved_record: 0,
      stable_loss_callees: {
        "src/vs/base/common/errors.ts:getUnexpectedErrorHandler": 4,
        "src/vs/base/common/errors.ts:onUnexpectedError": 2,
        "src/vs/base/common/errors.ts:setUnexpectedErrorHandler": 2,
        "src/vs/base/common/errors.ts:onUnexpectedExternalError": 1,
        "src/vs/base/parts/ipc/electron-main/ipcMain.ts:on": 1,
      },
    },
    {
      ingest_order: "shuffled",
      control_edges: 39636,
      candidate_edges: 39683,
      gained: 76,
      lost: 29,
      order_dependent_on_unpatched: 6,
      stable_on_unpatched: 23,
      retargeted: 0,
      now_unresolved: 19,
      no_unresolved_record: 4,
      stable_loss_callees: {
        "src/vs/base/common/errors.ts:getUnexpectedErrorHandler": 4,
        "src/vs/base/common/ime.ts:enabled": 4,
        "src/vs/base/common/errors.ts:onUnexpectedError": 2,
        "src/vs/base/common/errors.ts:setUnexpectedErrorHandler": 2,
        "src/vs/base/common/ime.ts:onDidChange": 2,
        "src/vs/editor/common/languages/modesRegistry.ts:registerLanguage": 2,
        "src/vs/base/common/idGenerator.ts:nextId": 2,
        "src/vs/base/common/errors.ts:onUnexpectedExternalError": 1,
        "src/vs/base/parts/ipc/electron-main/ipcMain.ts:on": 1,
        "src/vs/editor/common/inputMode.ts:getInputMode": 1,
        "src/vs/editor/common/languages/modesRegistry.ts:getLanguages": 1,
        "src/vs/editor/common/languages/modesRegistry.ts:onDidChangeLanguages": 1,
      },
    },
  ],
  edge_loss_verdict:
    "Measured at 1,200 files of `src`, seed 1, both trees run in all four orders. Most losses are pre-existing order-dependence: 55 of 77 forward, " +
    "39 of 43 reversed, 11 of 21 descending-size and 6 of 29 shuffled are edges the per-arrival driver itself failed to resolve under at least one " +
    "of the three named orders. The remainder is a real loss this driver owns — 22, 4, 10 and 23 edges — and every one of them reaches a method on " +
    "an exported singleton through a constructor binding, which is the defect TASK-381.11 states against `resolve_corpus` by name. Two claims first " +
    "made for this driver are refuted here: the reversed-order run does NOT give byte-identical edge sets between the two builds, and edges ARE lost " +
    "that the per-arrival driver resolved under all three named orders. Against them, the candidate resolves 693 edges forward that the per-arrival " +
    "driver did not, and 300 call sites forward that were unresolved before become resolved against 63 that stop resolving.",
};
