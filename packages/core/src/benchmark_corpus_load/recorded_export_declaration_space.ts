/**
 * What keying export metadata on (declaration space, name) did to the reported
 * call graph, measured over every file the corpus predicate discovers.
 *
 * This is the epic's re-baseline: the fingerprint below replaces the one
 * `RECORDED_FULL_CORPUS_BASELINE` carries, because 676 files that were read,
 * parsed, indexed and then discarded are now reported. A step that moves the
 * fingerprint has to account for every moved member, so the accounting sits
 * beside the digests rather than in a commit message.
 *
 * Both arms ran in one session on one box, interleaved control, candidate,
 * control, candidate, forward order, one process per arm on the harness command
 * line at `--max-old-space-size=12288`. The control arm is the identical stack
 * with this repair reverse-applied — the tree at `control_commit`, checked out
 * as a second worktree sharing the primary checkout's `node_modules` so both
 * arms resolve the same grammars.
 *
 * Two of the criteria this step was written against are refuted by its own
 * measurement and are carried in `superseded` rather than dropped. The CPU win
 * is not a win: it was booked against a tree whose bulk load still rolled a
 * failed ingest back through the incremental `remove_file`, and TASK-381.4
 * removed that cascade before this step ran. What is left is that 8% more files
 * are indexed for the same CPU.
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
  readonly observations: readonly number[];
}

/** One arm of the interleaved pair, run to completion in each of its processes. */
interface RecordedArm {
  readonly arm: "control" | "candidate";
  /** Positions in the interleaved sequence this arm occupied. */
  readonly sequence_indices: readonly number[];
  readonly discovered: number;
  readonly offered: number;
  readonly indexed: number;
  readonly dropped: number;
  /**
   * Calls to `Project.remove_file` over the load, counted by a wrapper
   * installed on the class prototype from outside, so no production file is
   * touched. Zero on BOTH arms: the bulk driver rolls a failed ingest back
   * through `evict_ingested_file`, so the rollback cascade this repair was once
   * expected to remove was already gone before it landed.
   */
  readonly remove_file_calls: number;
  /** `project.get_file_contents().size`, asserted rather than inferred. */
  readonly file_contents_size: number;
  readonly cpu_seconds: RecordedSpread;
  readonly peak_rss_mb: RecordedSpread;
  readonly cpu_per_wall: readonly number[];
  readonly loadavg_at_arm_start: readonly number[];
  /** Each of the seven components as `count/hash`, identical in both processes. */
  readonly fingerprint: Readonly<Record<string, string>>;
}

/** One fingerprint component and what moved inside it. */
interface RecordedComponentMove {
  readonly component: string;
  readonly control_count: number;
  readonly candidate_count: number;
  readonly only_control: number;
  readonly only_candidate: number;
}

/**
 * The entry-point accounting, taken at the RESOLUTION level: nodes, minus
 * `resolutions.get_all_referenced_symbols()`, minus anonymous callables. A
 * count that falls is not evidence on its own — a candidate disappears either
 * because it gained a caller or because its node did — so each direction is a
 * set difference against the called set and the node set.
 */
interface RecordedEntryPointAccounting {
  readonly raw_candidates_control: number;
  readonly raw_candidates_candidate: number;
  readonly removed: number;
  readonly removed_in_candidate_called_set: number;
  readonly removed_that_lost_their_node: number;
  readonly removed_unexplained: number;
  readonly added: number;
  readonly added_inside_readmitted_files: number;
  readonly added_outside_readmitted_files: number;
  /** Symbols that gain an incoming resolved call edge, against the 14 that lose one. */
  readonly symbols_newly_called: number;
}

/** One classified entry point the repair introduced outside the readmitted files. */
interface RecordedResidual {
  readonly site: string;
  /** Whether it is a raw candidate in each arm. */
  readonly raw_candidate_in_control: boolean;
  readonly raw_candidate_in_candidate: boolean;
  readonly cause: "classifier decision" | "call site retargeted";
}

/** A figure that is kept rather than deleted, with what replaced it and why. */
interface RecordedSupersession {
  readonly claim: string;
  readonly reason: string;
  readonly outcome: string;
}

export interface RecordedExportDeclarationSpace {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  readonly machine: string;
  readonly node_version: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly heap_cap_mb: number;
  readonly ingest_order: string;
  /** Shared by every arm below, which is what makes the ratio admissible. */
  readonly session_id: string;
  /** The tree the control arm measures: this repair reverse-applied. */
  readonly control_commit: string;
  /** The tree the candidate arms measure. */
  readonly candidate_tree: string;
  readonly arms: readonly RecordedArm[];
  /** Control CPU over candidate CPU, both means. Above 1.0 favours the candidate. */
  readonly cpu_ratio: number;
  /** What every drop over this corpus was, before the repair and after it. */
  readonly drop_taxonomy_control: Readonly<Record<string, number>>;
  readonly drop_taxonomy_candidate: Readonly<Record<string, number>>;
  /**
   * `nodes(control) \ nodes(candidate)`, by literal set difference over the
   * complete node id set rather than by comparing two counts.
   */
  readonly nodes_lost: number;
  readonly fingerprint_moves: readonly RecordedComponentMove[];
  readonly entry_point_accounting: RecordedEntryPointAccounting;
  readonly residual_outside_readmitted_files: readonly RecordedResidual[];
  readonly guards: {
    readonly new_export_guards: number;
    readonly failing_on_the_pre_repair_tree: number;
  };
  readonly superseded: readonly RecordedSupersession[];
  readonly note: string;
}

export const RECORDED_EXPORT_DECLARATION_SPACE: RecordedExportDeclarationSpace =
  {
    corpus: "microsoft/vscode",
    corpus_commit: "f3fa55c3",
    predicate: "src",
    discovered_files: 8494,
    machine: "Darwin 24.6.0 x64",
    node_version: "v22.22.1",
    cpu_count: 6,
    total_memory_mb: 32768,
    heap_cap_mb: 12336,
    ingest_order: "forward",
    session_id: "task-381.8",
    control_commit: "73cc6ab0",
    candidate_tree:
      "73cc6ab0 plus the TASK-381.8 working tree — the declaration-space key in registries/export.ts, the loader's drop_reasons, and the two triage coverage gates",

    arms: [
      {
        arm: "control",
        sequence_indices: [0, 2],
        discovered: 8494,
        offered: 8494,
        indexed: 7818,
        dropped: 676,
        remove_file_calls: 0,
        file_contents_size: 7818,
        cpu_seconds: {
          mean: 362.68,
          min: 343.35,
          max: 382.02,
          spread_percent: 10.66,
          cv_percent: 5.33,
          observations: [382.0194, 343.3466],
        },
        peak_rss_mb: {
          mean: 6914.1,
          min: 6738.4,
          max: 7089.8,
          spread_percent: 5.08,
          cv_percent: 2.54,
          observations: [7089.8, 6738.4],
        },
        cpu_per_wall: [1.02, 1.06],
        loadavg_at_arm_start: [3.3, 7.3],
        fingerprint: {
          nodes: "184957/eee36b26277fd292",
          call_edges: "322300/ac7bfdba0b002ff8",
          unresolved_calls: "543967/33d7de4ce0a7030d",
          raw_entry_points: "19816/9e8736700b47aa37",
          indirect_reachability_keys: "25811/16f2c4325fb5fba9",
          dropped_files: "676/003c1db7f45416b0",
          indirect_reachability_evidence: "25811/b87a2c5f358d23a4",
        },
      },
      {
        arm: "candidate",
        sequence_indices: [1, 3],
        discovered: 8494,
        offered: 8494,
        indexed: 8494,
        dropped: 0,
        remove_file_calls: 0,
        file_contents_size: 8494,
        cpu_seconds: {
          mean: 361.77,
          min: 349.97,
          max: 373.56,
          spread_percent: 6.52,
          cv_percent: 3.26,
          observations: [373.5614, 349.9749],
        },
        peak_rss_mb: {
          mean: 6911.75,
          min: 6678.1,
          max: 7145.4,
          spread_percent: 6.76,
          cv_percent: 3.38,
          observations: [7145.4, 6678.1],
        },
        cpu_per_wall: [0.85, 1.05],
        loadavg_at_arm_start: [4.6, 4.3],
        fingerprint: {
          nodes: "201595/1dee6f73bd6b19b3",
          call_edges: "1076088/9ebbb24c04c88952",
          unresolved_calls: "424057/bc249186fe32e982",
          raw_entry_points: "17647/4812efbaee47ef27",
          indirect_reachability_keys: "29375/f32e80ad5909e494",
          dropped_files: "0/e3b0c44298fc1c14",
          indirect_reachability_evidence: "29375/81d3bb3c789f39a6",
        },
      },
    ],

    cpu_ratio: 1,

    drop_taxonomy_control: {
      "Duplicate export name \"…\" in file <path>": 676,
    },
    drop_taxonomy_candidate: {},

    nodes_lost: 0,

    fingerprint_moves: [
      {
        component: "nodes",
        control_count: 184957,
        candidate_count: 201595,
        only_control: 0,
        only_candidate: 16638,
      },
      {
        component: "call_edges",
        control_count: 322300,
        candidate_count: 1076088,
        only_control: 1068,
        only_candidate: 754856,
      },
      {
        component: "unresolved_calls",
        control_count: 543967,
        candidate_count: 424057,
        only_control: 142824,
        only_candidate: 22914,
      },
      {
        component: "raw_entry_points",
        control_count: 19816,
        candidate_count: 17647,
        only_control: 4442,
        only_candidate: 2273,
      },
      {
        component: "indirect_reachability_keys",
        control_count: 25811,
        candidate_count: 29375,
        only_control: 0,
        only_candidate: 3564,
      },
      {
        component: "dropped_files",
        control_count: 676,
        candidate_count: 0,
        only_control: 676,
        only_candidate: 0,
      },
      {
        component: "indirect_reachability_evidence",
        control_count: 25811,
        candidate_count: 29375,
        only_control: 168,
        only_candidate: 3732,
      },
    ],

    entry_point_accounting: {
      raw_candidates_control: 24553,
      raw_candidates_candidate: 20099,
      removed: 6751,
      removed_in_candidate_called_set: 6751,
      removed_that_lost_their_node: 0,
      removed_unexplained: 0,
      added: 2297,
      added_inside_readmitted_files: 2283,
      added_outside_readmitted_files: 14,
      symbols_newly_called: 21421,
    },

    residual_outside_readmitted_files: [
      {
        site: "src/vs/editor/common/core/ranges/rangeMapping.ts:51:reverse",
        raw_candidate_in_control: true,
        raw_candidate_in_candidate: true,
        cause: "classifier decision",
      },
      {
        site: "src/vs/workbench/contrib/mergeEditor/browser/model/mapping.ts:74:reverse",
        raw_candidate_in_control: true,
        raw_candidate_in_candidate: true,
        cause: "classifier decision",
      },
      {
        site: "src/vs/workbench/contrib/mergeEditor/browser/model/mapping.ts:327:reverse",
        raw_candidate_in_control: true,
        raw_candidate_in_candidate: true,
        cause: "classifier decision",
      },
      {
        site: "src/vs/editor/browser/services/markerDecorations.ts:21:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/anchorSelect/browser/anchorSelect.ts:96:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/contextmenu/browser/contextmenu.ts:384:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/format/browser/formatActions.ts:173:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/gotoError/browser/gotoError.ts:55:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.ts:52:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/indentation/browser/indentation.ts:564:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/message/browser/messageController.ts:52:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/contrib/smartSelect/browser/smartSelect.ts:71:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/editor/standalone/browser/quickInput/standaloneQuickInputService.ts:188:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts:55:dispose",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/workbench/contrib/tasks/common/taskDefinitionRegistry.ts:151:onReady",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/workbench/contrib/tasks/common/taskDefinitionRegistry.ts:155:get",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
      {
        site: "src/vs/workbench/contrib/tasks/common/taskDefinitionRegistry.ts:163:getJsonSchema",
        raw_candidate_in_control: false,
        raw_candidate_in_candidate: true,
        cause: "call site retargeted",
      },
    ],

    guards: {
      new_export_guards: 11,
      failing_on_the_pre_repair_tree: 11,
    },

    superseded: [
      {
        claim:
          "The repair is bigger AND faster: at full corpus it costs >= 1.5x less CPU than the identical stack with it reverse-applied (2.202x on one machine, 1.570x composed with TASK-381.11 on another).",
        reason:
          "Both figures were taken on a tree whose bulk load still rolled a failed ingest back through the incremental `Project.remove_file`, re-resolving every dependent of each of the 603 dropped files. TASK-381.4's two-phase driver removed that cascade before this step ran, so the cost the repair was expected to remove was already zero: `Project.remove_file` is called ZERO times on BOTH arms here.",
        outcome:
          "REFUTED at 1.00x. Control 362.68 s (CV 5.33%) against candidate 361.77 s (CV 3.26%), two processes per arm, interleaved in one session. What the repair buys is not less CPU but more corpus for the same CPU: 8.65% more files indexed, 16,638 more nodes and 753,788 more resolved call edges at a cost the session's noise cannot distinguish from zero.",
      },
      {
        claim: "Peak RSS is <= 6.6 GB as a mean of >= 2 runs.",
        reason:
          "The 4,194.1 / 5,040.5 MB readings behind that bound came from a 4-core Darwin 21.6.0 box. Peak RSS at a fixed heap cap is machine-bound in the same way absolute CPU is, and on this 6-core box the CONTROL arm — which does not carry the repair at all — already means 6,914.1 MB.",
        outcome:
          "REFUTED as a portable bound and replaced by a same-session difference. Candidate 6,911.75 MB against control 6,914.1 MB, a difference of -2.35 MB (-0.03%) that both arms' run-to-run spread (5.08% and 6.76%) swamps. The repair costs no memory; the absolute is a property of the box and the 12,336 MB cap.",
      },
      {
        claim:
          "The residual is <= 10 classified entry points outside the readmitted files and each is traced to a CLASSIFIER decision, not a call site.",
        reason:
          "Measured here at 17, and only 3 of them are classifier decisions. The other 14 are call sites that retarget: each was called in the control arm and is not called in the candidate arm, while its node survives (nodes lost = 0) and 21,421 other symbols gain an incoming edge. Eleven are `dispose` methods, and `lifecycle.ts` and `event.ts` — which declare `IDisposable` and `Event` — are among the 676 readmitted files, so a `.dispose()` call that had no interface to prefer now has one.",
        outcome:
          "The bound is NOT met on this tree. The residual is 17, fully enumerated in `residual_outside_readmitted_files` with each one's cause, and the retarget population has its own follow-up task. The three `reverse` sites the earlier write-up named are confirmed exactly — `rangeMapping.ts:51`, `mergeEditor/model/mapping.ts:74` and `:327` — and the `TaskDefinitionRegistry` attribution it called REFUTED is back on this configuration, which carries TASK-381.11 nowhere.",
      },
      {
        claim:
          "The declaration-space key covers 595 of 603 dropped files under vscode's `src/`.",
        reason:
          "The landed tree drops 676, not 603: `RECORDED_FULL_CORPUS_BASELINE` already recorded that the composed prototype's 7,891/603 does not describe it.",
        outcome:
          "SUPERSEDED. All 676 are readmitted, and all 676 were the same defect — the drop taxonomy over the control arm is a single entry, `Duplicate export name \"…\" in file <path>` at 676. `Multiple default exports` fires on no file of this corpus.",
      },
    ],

    note:
      "Every arm offered all 8,494 files its predicate discovered to one process and ran to completion. Coverage is asserted two ways rather than inferred from `dropped_files`: a `Project.remove_file` counter wrapped on the class prototype from outside, and `project.get_file_contents().size`. Both agree at 8,494/0/0 for the candidate and 7,818/676/0 for the control. " +
      "The seven fingerprint components are byte-identical across the two processes of each arm, so the re-baseline is a property of the tree rather than of a run. " +
      "The load path is unchanged: `load_project`'s try/catch and `Project.evict_ingested_file` rollback stay in place as the general per-file indexing-failure boundary, and over this corpus they now fire zero times. " +
      "`dropped_files` being empty is a property of THIS corpus and not of the repair. Pointed at the repository root the same stack still meets a scope-tree invariant on one file, which is a different gate with its own follow-up.",
  };
