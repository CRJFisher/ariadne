/**
 * Where every call reference of the nine evidence corpora this box can hold
 * ended up on the tree TASK-376 started from — resolved, or failed for one
 * named reason — and why the tenth is refused.
 *
 * This is the row every later step of the epic is judged against. A step that
 * records an annotation, a self type or a member set claims to turn some
 * failures into resolved calls, and the claim is only a number when the same
 * corpus, at the same commit, over the same file set, is counted before and
 * after. So each row names the corpus commit, the predicate — the triage
 * project config's `exclude` list where one exists, so the file set is the one
 * the triage runs indexed — and the file counts, and carries the seven-number
 * fingerprint beside the taxonomy so a later arm can say whether it describes
 * the same call graph. The Ariadne commit and the grammar versions are
 * properties of the session, not of a corpus, and sit on the record itself.
 *
 * Every arm ran alone, in its own process, forward order, over every file its
 * predicate discovered:
 *
 *   node --import tsx packages/core/scripts/run_load_benchmark.ts --baseline \
 *     --corpus-root ~/.ariadne/triage-entrypoints/repos/<owner>--<repo> \
 *     --corpus-name <corpus> --corpus-commit <corpus_commit> \
 *     --predicate <predicate>
 *
 * Every argument but `--corpus-root` is read off the row below. Loadavg and
 * cpu/wall are recorded because the box was shared during the session; neither
 * figure is quoted as a cost, and no ratio is ever taken between two rows here.
 *
 * A corpus the harness refuses is recorded under `not_measured` with the
 * refusal, never as a partial number. The refusal is the heap the harness would
 * have to hand the arm, against the memory the box has; `required_heap_mb` is a
 * two-point linear fit unverified above 600 files and over-provisions at corpus
 * scale, so re-fitting it against a measured floor is a third way to obtain a
 * refused row, beside a larger box and a narrower predicate.
 */

import type { FailureTaxonomy } from "./failure_taxonomy";
import type { FingerprintComponentName } from "./call_graph_fingerprint";

export interface RecordedFailureTaxonomyRow {
  /** Stable corpus name, e.g. "django/django". */
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly file_counts: {
    readonly discovered: number;
    readonly offered: number;
    readonly indexed: number;
    readonly dropped: number;
  };
  readonly session_id: string;
  readonly heap_cap_mb: number;
  readonly cpu_seconds: number;
  readonly wall_seconds: number;
  readonly cpu_per_wall: number;
  readonly loadavg_at_start: readonly [number, number, number];
  /** Each of the seven components as `count/hash`. */
  readonly fingerprint: Readonly<Record<FingerprintComponentName, string>>;
  readonly failure_taxonomy: FailureTaxonomy;
}

export interface RecordedRefusedCorpus {
  readonly corpus: string;
  readonly corpus_commit: string;
  readonly predicate: string;
  readonly discovered_files: number;
  /** The harness's own refusal, verbatim. */
  readonly reason: string;
}

export interface RecordedFailureTaxonomyBaseline {
  readonly ariadne_commit: string;
  readonly machine: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly node_version: string;
  readonly tree_sitter_version: string;
  readonly tree_sitter_typescript_version: string;
  readonly rows: readonly RecordedFailureTaxonomyRow[];
  readonly not_measured: readonly RecordedRefusedCorpus[];
}

export const RECORDED_FAILURE_TAXONOMY_BASELINE: RecordedFailureTaxonomyBaseline = {
  // The tree at 279221d4 carrying this step's own change, which adds the
  // taxonomy to the harness and closes one structurally open resolver exit no
  // producer takes; the fingerprint of every row is what 279221d4 reports.
  // Landed as 8ed82229, "emit a ResolutionFailure for every call reference the
  // resolver drops".
  ariadne_commit: "279221d4",
  machine: "Darwin 24.6.0 x64",
  cpu_count: 6,
  total_memory_mb: 32768,
  node_version: "v22.22.1",
  tree_sitter_version: "0.25.0",
  tree_sitter_typescript_version: "0.23.2",
  rows: [
    {
      corpus: "angular/angular",
      corpus_commit: "5ad823139758b4d3a8a021d378b008c3457f8689",
      predicate: "repository-root",
      file_counts: { discovered: 6345, offered: 6345, indexed: 6345, dropped: 0 },
      session_id: "Chucks-iMac.local-59772-2026-09-07T11-58-10-930Z",
      heap_cap_mb: 11652,
      cpu_seconds: 101.3,
      wall_seconds: 86.3,
      cpu_per_wall: 1.17,
      loadavg_at_start: [5.2, 4.6, 4.3],
      fingerprint: {
        nodes: "70838/d82600bd75e718ea",
        call_edges: "141018/0fc6486ba26c7c5e",
        unresolved_calls: "228551/46fe81264b25294e",
        raw_entry_points: "4276/515144f84a6a10b1",
        indirect_reachability_keys: "12107/d3838c5469268820",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "12107/b698ff8e88e0b209",
      },
      failure_taxonomy: {
        call_references: 376867,
        resolved: 148316,
        by_reason: {
          name_not_in_scope: 148164,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 61449,
          method_not_on_type: 6131,
          polymorphic_no_implementations: 941,
          collection_dispatch_miss: 324,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 107,
          class_definition_not_found: 1726,
          no_parent_class: 151,
          member_type_unknown: 7500,
          definition_has_no_body_scope: 4,
          constructor_target_not_a_class: 2054,
        },
      },
    },
    {
      corpus: "rust-lang/rust",
      corpus_commit: "e7b595554e664e6bd281c8cf881093d6c71bc0e1",
      predicate: "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      file_counts: { discovered: 3516, offered: 3516, indexed: 3516, dropped: 0 },
      session_id: "Chucks-iMac.local-57391-2026-09-07T11-56-32-073Z",
      heap_cap_mb: 6702,
      cpu_seconds: 95.2,
      wall_seconds: 77.1,
      cpu_per_wall: 1.24,
      loadavg_at_start: [4.7, 4.5, 4.2],
      fingerprint: {
        nodes: "55028/5c2ad96b7300be92",
        call_edges: "63810/8dffd7da70fe0f1b",
        unresolved_calls: "251150/5eaf687c0b00e29d",
        raw_entry_points: "16988/87a2be4fa6a4a897",
        indirect_reachability_keys: "12080/624e7a532d6a0930",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "12080/7278da2945281a6f",
      },
      failure_taxonomy: {
        call_references: 329884,
        resolved: 78734,
        by_reason: {
          name_not_in_scope: 91009,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 101003,
          method_not_on_type: 9694,
          polymorphic_no_implementations: 492,
          collection_dispatch_miss: 296,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 27173,
          class_definition_not_found: 238,
          no_parent_class: 654,
          member_type_unknown: 19500,
          definition_has_no_body_scope: 5,
          constructor_target_not_a_class: 1086,
        },
      },
    },
    {
      corpus: "tokio-rs/tokio",
      corpus_commit: "1a2dbbaa21389ad0b9d20f77e869698c5cab5d68",
      predicate: "repository-root",
      file_counts: { discovered: 790, offered: 790, indexed: 790, dropped: 0 },
      session_id: "Chucks-iMac.local-41532-2026-09-07T11-48-57-082Z",
      heap_cap_mb: 2096,
      cpu_seconds: 10.3,
      wall_seconds: 8,
      cpu_per_wall: 1.3,
      loadavg_at_start: [6.1, 4.4, 4.1],
      fingerprint: {
        nodes: "7847/7fa15ac544251312",
        call_edges: "7067/a988fe8bcf3e5a91",
        unresolved_calls: "27459/bb24e38a34a8eb00",
        raw_entry_points: "1797/1828e398198d4536",
        indirect_reachability_keys: "1547/d2fab94110cea16e",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "1547/b144077d01b00871",
      },
      failure_taxonomy: {
        call_references: 35573,
        resolved: 8114,
        by_reason: {
          name_not_in_scope: 14258,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 8404,
          method_not_on_type: 690,
          polymorphic_no_implementations: 4,
          collection_dispatch_miss: 17,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 1493,
          class_definition_not_found: 118,
          no_parent_class: 218,
          member_type_unknown: 2220,
          definition_has_no_body_scope: 1,
          constructor_target_not_a_class: 36,
        },
      },
    },
    {
      corpus: "launchbadge/sqlx",
      corpus_commit: "1d674f51581598f55436451d5b4b73100cae0b56",
      predicate: "repository-root",
      file_counts: { discovered: 459, offered: 459, indexed: 459, dropped: 0 },
      session_id: "Chucks-iMac.local-41058-2026-09-07T11-48-49-505Z",
      heap_cap_mb: 2096,
      cpu_seconds: 6.1,
      wall_seconds: 4.5,
      cpu_per_wall: 1.35,
      loadavg_at_start: [6.5, 4.4, 4.1],
      fingerprint: {
        nodes: "3453/74c89a503ba89213",
        call_edges: "2914/0faaf9314552ea0d",
        unresolved_calls: "15255/e04e5b7864f7b71e",
        raw_entry_points: "1087/d675dacac597085d",
        indirect_reachability_keys: "644/0ee3bb79cb401f70",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "644/603685409a7ae2a4",
      },
      failure_taxonomy: {
        call_references: 18778,
        resolved: 3523,
        by_reason: {
          name_not_in_scope: 8879,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 4570,
          method_not_on_type: 369,
          polymorphic_no_implementations: 23,
          collection_dispatch_miss: 6,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 448,
          class_definition_not_found: 33,
          no_parent_class: 26,
          member_type_unknown: 860,
          definition_has_no_body_scope: 1,
          constructor_target_not_a_class: 40,
        },
      },
    },
    {
      corpus: "django/django",
      corpus_commit: "957d0cee7167757ae221ffde59d2cf0a322e89c7",
      predicate: "repository-root-excluding:js_tests,scripts,docs",
      file_counts: { discovered: 3012, offered: 3012, indexed: 3012, dropped: 0 },
      session_id: "Chucks-iMac.local-50373-2026-09-07T11-52-22-255Z",
      heap_cap_mb: 5820,
      cpu_seconds: 255.3,
      wall_seconds: 239.7,
      cpu_per_wall: 1.07,
      loadavg_at_start: [4.8, 4.5, 4.2],
      fingerprint: {
        nodes: "35611/36979b9df2734f2c",
        call_edges: "68673/238140a5841f8b68",
        unresolved_calls: "154689/be8db994bd70596d",
        raw_entry_points: "2494/58d81fdfd41ecc78",
        indirect_reachability_keys: "8082/57c4d4e30deba248",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "8082/7893bccd1e1cb869",
      },
      failure_taxonomy: {
        call_references: 256358,
        resolved: 101669,
        by_reason: {
          name_not_in_scope: 49789,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 19120,
          method_not_on_type: 66965,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 309,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 406,
          class_definition_not_found: 297,
          no_parent_class: 764,
          member_type_unknown: 2018,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 15021,
        },
      },
    },
    {
      corpus: "pandas-dev/pandas",
      corpus_commit: "7986b42596f2354a0970c708ab6072172fe4d06b",
      predicate: "repository-root",
      file_counts: { discovered: 1510, offered: 1510, indexed: 1510, dropped: 0 },
      session_id: "Chucks-iMac.local-42663-2026-09-07T11-49-09-938Z",
      heap_cap_mb: 3191,
      cpu_seconds: 195.5,
      wall_seconds: 182.4,
      cpu_per_wall: 1.07,
      loadavg_at_start: [5.6, 4.4, 4.1],
      fingerprint: {
        nodes: "33288/e23433051c6f1fa3",
        call_edges: "76324/30635d6435d95f69",
        unresolved_calls: "197677/4d8184dd11f8fec3",
        raw_entry_points: "2298/d9ce8689cb3e6471",
        indirect_reachability_keys: "5618/81dd6b602607550f",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "5618/f8551b8c3d459304",
      },
      failure_taxonomy: {
        call_references: 337503,
        resolved: 139826,
        by_reason: {
          name_not_in_scope: 106426,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 26161,
          method_not_on_type: 41647,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 46,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 45,
          class_definition_not_found: 20,
          no_parent_class: 441,
          member_type_unknown: 1471,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 21420,
        },
      },
    },
    {
      corpus: "celery/celery",
      corpus_commit: "7c5d9a62d90c685bd0e1ae002d66ae40980b2847",
      predicate: "repository-root",
      file_counts: { discovered: 418, offered: 418, indexed: 418, dropped: 0 },
      session_id: "Chucks-iMac.local-40002-2026-09-07T11-48-27-748Z",
      heap_cap_mb: 2096,
      cpu_seconds: 20.9,
      wall_seconds: 18.7,
      cpu_per_wall: 1.12,
      loadavg_at_start: [4.4, 3.8, 3.9],
      fingerprint: {
        nodes: "7943/b7c17039c89f0c23",
        call_edges: "9276/a2218a1a143b67ef",
        unresolved_calls: "36665/cf2c31167962a335",
        raw_entry_points: "800/e129c1cfc4160c0a",
        indirect_reachability_keys: "2541/d8ac2fb4a4e77c93",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "2541/060da30b0f7a365f",
      },
      failure_taxonomy: {
        call_references: 49805,
        resolved: 13140,
        by_reason: {
          name_not_in_scope: 20089,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 6664,
          method_not_on_type: 5339,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 13,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 36,
          class_definition_not_found: 32,
          no_parent_class: 146,
          member_type_unknown: 940,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 3406,
        },
      },
    },
    {
      corpus: "expressjs/express",
      corpus_commit: "ae6dd37680e3a00618d6c8a3e522f0ee4eeba1a4",
      predicate: "repository-root",
      file_counts: { discovered: 141, offered: 141, indexed: 141, dropped: 0 },
      session_id: "Chucks-iMac.local-39361-2026-09-07T11-48-18-460Z",
      heap_cap_mb: 2096,
      cpu_seconds: 2.9,
      wall_seconds: 2.3,
      cpu_per_wall: 1.25,
      loadavg_at_start: [4.4, 3.8, 3.9],
      fingerprint: {
        nodes: "3094/625af45987bb2fdb",
        call_edges: "5239/5f6758515ba0ae7c",
        unresolved_calls: "9114/ecdd8b7a7b9091e1",
        raw_entry_points: "21/b7322c183282a2ee",
        indirect_reachability_keys: "247/4824a26cac4c9464",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "247/d9686cd6f468b0ad",
      },
      failure_taxonomy: {
        call_references: 14543,
        resolved: 5429,
        by_reason: {
          name_not_in_scope: 5458,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 2825,
          method_not_on_type: 670,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 44,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 41,
          class_definition_not_found: 0,
          no_parent_class: 0,
          member_type_unknown: 0,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 76,
        },
      },
    },
    {
      corpus: "mochajs/mocha",
      corpus_commit: "7cb267830c51d0b9a851086eb8d87013ee7663bd",
      predicate: "repository-root",
      file_counts: { discovered: 534, offered: 534, indexed: 534, dropped: 0 },
      session_id: "Chucks-iMac.local-39731-2026-09-07T11-48-22-248Z",
      heap_cap_mb: 2096,
      cpu_seconds: 4.8,
      wall_seconds: 3.7,
      cpu_per_wall: 1.29,
      loadavg_at_start: [4.4, 3.8, 3.9],
      fingerprint: {
        nodes: "5446/e7890d7c2e922814",
        call_edges: "6884/cc666db2c1a107e7",
        unresolved_calls: "12534/00127b747b98e48f",
        raw_entry_points: "75/8b197c7ca3d88793",
        indirect_reachability_keys: "565/18004c4b3a5244ff",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "565/c821e24215aeb351",
      },
      failure_taxonomy: {
        call_references: 19965,
        resolved: 7431,
        by_reason: {
          name_not_in_scope: 8793,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 1871,
          method_not_on_type: 1248,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 30,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 227,
          class_definition_not_found: 39,
          no_parent_class: 2,
          member_type_unknown: 23,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 301,
        },
      },
    },
  ],
  not_measured: [
    {
      corpus: "microsoft/TypeScript",
      corpus_commit: "cc5c6e2d32e2228fff83a66537bbe6042943054d",
      predicate: "repository-root-excluding:baselines",
      discovered_files: 19783,
      reason:
        "Refusing to spawn a 19783-file arm over microsoft/TypeScript: it needs a 35122 MB heap (28097 MB required plus headroom) and this box has 32768 MB of memory. Narrow the predicate, or measure on a box that can hold it; a partial arm is never recorded.",
    },
  ],
};
