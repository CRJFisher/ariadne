/**
 * What the pipeline resolves on each evidence corpus.
 *
 * `recorded_failure_taxonomy_baseline.ts` records where the nine measurable
 * corpora stood before TASK-376 began. This records where they stand now, from
 * arms run against that same baseline tree in one session on one box, and it
 * is the row a later change is judged against: a step claiming recovery states
 * the same corpus, at the same commit, over the same file set, before and
 * after, and the numbers here are the "before".
 *
 * Two facts a reader needs before comparing a row here with a baseline row:
 *
 * **A call-reference count is not a quality figure.** The Python heuristic
 * constructor capture (deleted in TASK-376.2) recorded every argument-bearing
 * call a second time, so the baseline's Python rows count call references that
 * were never distinct calls. pandas falls by 93,143 references and django by
 * 53,468 for that reason alone, and `resolved` falls with them because half of
 * each doubled pair had resolved. What moved is `raw_entry_points` and the
 * per-reason split, not the totals.
 *
 * **An entry-point count is comparable only over one node set.** TASK-376.8
 * attaches a Rust type's cross-file `impl` methods to the type, which makes
 * those methods definitions the graph holds at all: tokio gains 994 nodes and
 * sqlx 848. A method nothing in the corpus calls is a raw entry point, so both
 * corpora report more entry points while resolving strictly more of the calls
 * they already held. Over the nodes both trees hold, tokio gains two entry
 * points and sqlx one; those three are named in the step's task notes.
 *
 * **microsoft/TypeScript is here for the first time.** It is the largest
 * corpus of the ten and it went unmeasured through all of TASK-376, refused by
 * a heap guard that demanded 28,096 MB for its 19,783 files. It peaks at 3,623
 * MB. It is also the epic's best result: raw entry points fall 1,201 -> 758,
 * a 37% reduction, with exactly one entry point gained — and that one is a
 * false edge the control held, `program.getSourceFile(...)` on a `ts.Program`
 * receiver wrongly reaching `fakes.CompilerHost.getSourceFile`.
 *
 * The permanent limitations are recorded beside the rows because a success
 * criterion must not target them: each is a construct whose callee is not in
 * the source at all, so no resolver change reaches it.
 */

import type { FailureTaxonomy } from "./failure_taxonomy";
import type { FingerprintComponentName } from "./call_graph_fingerprint";

export interface RecordedCorpusResolutionRow {
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

/**
 * A construct whose callee is absent from the corpus source, so the call it
 * makes can never be an edge this pipeline derives.
 *
 * These are recorded, not fixed. Each names one site a reader can open. A
 * limitation whose shape a classifier can recognise carries the group id it
 * would be filed under in `.claude/skills/triage/known_issues/registry.json`;
 * one whose shape has no syntactic tell carries `null`, and stays residue.
 */
export interface PermanentLimitation {
  readonly corpus: string;
  /** `<path>:<line>` inside that corpus, or the construct where no one site stands for it. */
  readonly site: string;
  readonly construct: string;
  /** Why no resolver change reaches it. */
  readonly why: string;
  readonly registry_candidate: string | null;
}

export interface RecordedCorpusResolution {
  readonly ariadne_commit: string;
  readonly control_commit: string;
  readonly machine: string;
  readonly cpu_count: number;
  readonly total_memory_mb: number;
  readonly node_version: string;
  readonly tree_sitter_version: string;
  readonly tree_sitter_typescript_version: string;
  readonly rows: readonly RecordedCorpusResolutionRow[];
  readonly not_measured: readonly RecordedRefusedCorpus[];
  readonly permanent_limitations: readonly PermanentLimitation[];
}

export const RECORDED_CORPUS_RESOLUTION: RecordedCorpusResolution = {
  // The tree at 038b7daa carrying this step's own change, which adds this
  // record, the corpus-level end-to-end suite and the follow-on backlog rows.
  // Every candidate arm ran that tree; every control arm ran a3d5beea, the
  // tree `recorded_failure_taxonomy_baseline.ts` was measured on.
  ariadne_commit: "038b7daa",
  control_commit: "a3d5beea",
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
      session_id: "Chucks-iMac.local-51825-2026-09-19T12-38-05-064Z",
      heap_cap_mb: 11652,
      cpu_seconds: 113.8,
      wall_seconds: 56.7,
      cpu_per_wall: 2.01,
      loadavg_at_start: [3.8, 4.9, 5.7],
      fingerprint: {
        nodes: "71428/fd444b26588a3f78",
        call_edges: "158057/cb691a9a2fc74fc0",
        unresolved_calls: "218696/e4116d5ace1ca719",
        raw_entry_points: "3096/0fa1c51630da2033",
        indirect_reachability_keys: "12345/1982f1f2a8a6336a",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "12345/396d24d250585a4e",
      },
      failure_taxonomy: {
        call_references: 378862,
        resolved: 160166,
        by_reason: {
          name_not_in_scope: 147979,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 51249,
          method_not_on_type: 5509,
          polymorphic_no_implementations: 1311,
          collection_dispatch_miss: 331,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 1247,
          class_definition_not_found: 0,
          no_parent_class: 134,
          member_type_unknown: 8883,
          definition_has_no_body_scope: 4,
          constructor_target_not_a_class: 2049,
        },
      },
    },
    {
      corpus: "rust-lang/rust",
      corpus_commit: "e7b595554e664e6bd281c8cf881093d6c71bc0e1",
      predicate: "repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests",
      file_counts: { discovered: 3516, offered: 3516, indexed: 3516, dropped: 0 },
      session_id: "Chucks-iMac.local-77017-2026-09-19T12-49-39-912Z",
      heap_cap_mb: 6702,
      cpu_seconds: 99.8,
      wall_seconds: 79.5,
      cpu_per_wall: 1.26,
      loadavg_at_start: [4, 4.6, 5.1],
      fingerprint: {
        nodes: "64979/593869763eefe352",
        call_edges: "96180/59f6ab61c6ac2c47",
        unresolved_calls: "211984/a43a0d70ae1431de",
        raw_entry_points: "19732/9c30f07ba0f1b504",
        indirect_reachability_keys: "13379/84e5e4af6b3e0c04",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "13379/f2fa80d30e72aa43",
      },
      failure_taxonomy: {
        call_references: 325188,
        resolved: 113204,
        by_reason: {
          name_not_in_scope: 77899,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 85841,
          method_not_on_type: 19320,
          polymorphic_no_implementations: 250,
          collection_dispatch_miss: 292,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 2567,
          class_definition_not_found: 4953,
          no_parent_class: 5,
          member_type_unknown: 20279,
          definition_has_no_body_scope: 5,
          constructor_target_not_a_class: 573,
        },
      },
    },
    {
      corpus: "tokio-rs/tokio",
      corpus_commit: "1a2dbbaa21389ad0b9d20f77e869698c5cab5d68",
      predicate: "repository-root",
      file_counts: { discovered: 790, offered: 790, indexed: 790, dropped: 0 },
      session_id: "Chucks-iMac.local-82313-2026-09-19T12-52-21-014Z",
      heap_cap_mb: 2096,
      cpu_seconds: 10.7,
      wall_seconds: 7.7,
      cpu_per_wall: 1.38,
      loadavg_at_start: [5.6, 5.1, 5.2],
      fingerprint: {
        nodes: "8841/92b5c57dedad488a",
        call_edges: "7762/2563e767fe6cf041",
        unresolved_calls: "26047/97eb638c1482890f",
        raw_entry_points: "2363/4a2a3720bdc8ea92",
        indirect_reachability_keys: "1724/9271f109614b21ad",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "1724/16614fad294b9722",
      },
      failure_taxonomy: {
        call_references: 34860,
        resolved: 8813,
        by_reason: {
          name_not_in_scope: 13963,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 8251,
          method_not_on_type: 866,
          polymorphic_no_implementations: 2,
          collection_dispatch_miss: 17,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 35,
          class_definition_not_found: 986,
          no_parent_class: 4,
          member_type_unknown: 1886,
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
      session_id: "Chucks-iMac.local-81677-2026-09-19T12-52-02-982Z",
      heap_cap_mb: 2096,
      cpu_seconds: 6.5,
      wall_seconds: 4.5,
      cpu_per_wall: 1.44,
      loadavg_at_start: [6, 5.1, 5.3],
      fingerprint: {
        nodes: "4301/ea1b606c7aea194b",
        call_edges: "3597/62cb9fbc62441f22",
        unresolved_calls: "14531/219a345d84f963c2",
        raw_entry_points: "1524/4b388e614fe9b4d3",
        indirect_reachability_keys: "835/5b7d6b9d9261c5a1",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "835/126b748b4eeab9e2",
      },
      failure_taxonomy: {
        call_references: 18564,
        resolved: 4033,
        by_reason: {
          name_not_in_scope: 8320,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 4592,
          method_not_on_type: 467,
          polymorphic_no_implementations: 9,
          collection_dispatch_miss: 6,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 95,
          class_definition_not_found: 123,
          no_parent_class: 0,
          member_type_unknown: 912,
          definition_has_no_body_scope: 1,
          constructor_target_not_a_class: 6,
        },
      },
    },
    {
      corpus: "microsoft/TypeScript",
      corpus_commit: "cc5c6e2d32e2228fff83a66537bbe6042943054d",
      predicate: "repository-root-excluding:baselines",
      file_counts: { discovered: 19783, offered: 19783, indexed: 19763, dropped: 20 },
      session_id: "Chucks-iMac.local-15635-2026-09-19T13-53-32-350Z",
      heap_cap_mb: 14288,
      cpu_seconds: 103.5,
      wall_seconds: 84.3,
      cpu_per_wall: 1.23,
      loadavg_at_start: [5.3, 4.5, 4.2],
      fingerprint: {
        nodes: "50332/4551130978db5ae6",
        call_edges: "75036/a918b8412d3781f1",
        unresolved_calls: "59732/079e1d193185c9ff",
        raw_entry_points: "758/e76d74254f09d1eb",
        indirect_reachability_keys: "19055/942e69ca0eb90ce4",
        dropped_files: "20/35096e8b3b7b6ea5",
        indirect_reachability_evidence: "19055/8e5b27b066fda8b2",
      },
      failure_taxonomy: {
        call_references: 153090,
        resolved: 93358,
        by_reason: {
          name_not_in_scope: 31826,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 15471,
          method_not_on_type: 2027,
          polymorphic_no_implementations: 7764,
          collection_dispatch_miss: 264,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 250,
          class_definition_not_found: 0,
          no_parent_class: 141,
          member_type_unknown: 1429,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 560,
        },
      },
    },
    {
      corpus: "django/django",
      corpus_commit: "957d0cee7167757ae221ffde59d2cf0a322e89c7",
      predicate: "repository-root-excluding:js_tests,scripts,docs",
      file_counts: { discovered: 3012, offered: 3012, indexed: 3012, dropped: 0 },
      session_id: "Chucks-iMac.local-62950-2026-09-19T12-43-31-170Z",
      heap_cap_mb: 5820,
      cpu_seconds: 277.1,
      wall_seconds: 259.3,
      cpu_per_wall: 1.07,
      loadavg_at_start: [5.3, 5.1, 5.5],
      fingerprint: {
        nodes: "36234/602f1e1bc0733680",
        call_edges: "67102/53388e412e6752df",
        unresolved_calls: "117094/a0694fc7c9b0ba1c",
        raw_entry_points: "2289/0aaee81b5fd68199",
        indirect_reachability_keys: "8463/5d4cc57d00460fc8",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "8463/688e92bf2fbf3fe5",
      },
      failure_taxonomy: {
        call_references: 202972,
        resolved: 85878,
        by_reason: {
          name_not_in_scope: 30477,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 20899,
          method_not_on_type: 62496,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 242,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 373,
          class_definition_not_found: 0,
          no_parent_class: 383,
          member_type_unknown: 2161,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 63,
        },
      },
    },
    {
      corpus: "pandas-dev/pandas",
      corpus_commit: "7986b42596f2354a0970c708ab6072172fe4d06b",
      predicate: "repository-root",
      file_counts: { discovered: 1510, offered: 1510, indexed: 1510, dropped: 0 },
      session_id: "Chucks-iMac.local-41107-2026-09-19T12-33-24-098Z",
      heap_cap_mb: 3191,
      cpu_seconds: 186.9,
      wall_seconds: 172.3,
      cpu_per_wall: 1.08,
      loadavg_at_start: [5.5, 6.5, 6.4],
      fingerprint: {
        nodes: "33288/e23433051c6f1fa3",
        call_edges: "84238/a06f367fd1cef9f9",
        unresolved_calls: "126409/15bcc0715e796ce5",
        raw_entry_points: "2085/db43ca21a234f957",
        indirect_reachability_keys: "5759/46f7c5a285a33084",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "5759/516d44aeb0deea3d",
      },
      failure_taxonomy: {
        call_references: 244360,
        resolved: 117951,
        by_reason: {
          name_not_in_scope: 61121,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 24809,
          method_not_on_type: 38861,
          polymorphic_no_implementations: 1,
          collection_dispatch_miss: 41,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 45,
          class_definition_not_found: 0,
          no_parent_class: 51,
          member_type_unknown: 1480,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 0,
        },
      },
    },
    {
      corpus: "celery/celery",
      corpus_commit: "7c5d9a62d90c685bd0e1ae002d66ae40980b2847",
      predicate: "repository-root",
      file_counts: { discovered: 418, offered: 418, indexed: 418, dropped: 0 },
      session_id: "Chucks-iMac.local-83177-2026-09-19T12-52-52-431Z",
      heap_cap_mb: 2096,
      cpu_seconds: 21.6,
      wall_seconds: 17.9,
      cpu_per_wall: 1.21,
      loadavg_at_start: [5.3, 5.1, 5.2],
      fingerprint: {
        nodes: "7943/b7c17039c89f0c23",
        call_edges: "9465/ec1a392767f1961b",
        unresolved_calls: "23834/36fc12bb29de1dd8",
        raw_entry_points: "730/1d60237c663024eb",
        indirect_reachability_keys: "2608/4873efa4607a2133",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "2608/481634ed911d7144",
      },
      failure_taxonomy: {
        call_references: 35088,
        resolved: 11254,
        by_reason: {
          name_not_in_scope: 11049,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 7062,
          method_not_on_type: 4484,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 13,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 36,
          class_definition_not_found: 0,
          no_parent_class: 118,
          member_type_unknown: 1072,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 0,
        },
      },
    },
    {
      corpus: "expressjs/express",
      corpus_commit: "ae6dd37680e3a00618d6c8a3e522f0ee4eeba1a4",
      predicate: "repository-root",
      file_counts: { discovered: 141, offered: 141, indexed: 141, dropped: 0 },
      session_id: "Chucks-iMac.local-81021-2026-09-19T12-51-41-918Z",
      heap_cap_mb: 2096,
      cpu_seconds: 3.1,
      wall_seconds: 2.3,
      cpu_per_wall: 1.39,
      loadavg_at_start: [6.1, 5.1, 5.2],
      fingerprint: {
        nodes: "3132/57bde72f59e983b5",
        call_edges: "5250/918cdc70da32f0ad",
        unresolved_calls: "9107/fc15446bce83f0dd",
        raw_entry_points: "21/b7322c183282a2ee",
        indirect_reachability_keys: "247/4824a26cac4c9464",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "247/d9686cd6f468b0ad",
      },
      failure_taxonomy: {
        call_references: 14543,
        resolved: 5436,
        by_reason: {
          name_not_in_scope: 5442,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 2979,
          method_not_on_type: 527,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 44,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 39,
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
      session_id: "Chucks-iMac.local-81197-2026-09-19T12-51-50-725Z",
      heap_cap_mb: 2096,
      cpu_seconds: 5.1,
      wall_seconds: 3.8,
      cpu_per_wall: 1.36,
      loadavg_at_start: [6.1, 5.1, 5.2],
      fingerprint: {
        nodes: "5565/90b6aceb2fe039c0",
        call_edges: "6936/afabd88fe21cf4a1",
        unresolved_calls: "12480/7abf20e1df2bd635",
        raw_entry_points: "71/e5fbbc872b11a3e1",
        indirect_reachability_keys: "566/2e714ccba1ec280d",
        dropped_files: "0/e3b0c44298fc1c14",
        indirect_reachability_evidence: "566/8af8002a8c8e53e9",
      },
      failure_taxonomy: {
        call_references: 19965,
        resolved: 7485,
        by_reason: {
          name_not_in_scope: 8739,
          import_unresolved: 0,
          reexport_chain_unresolved: 0,
          receiver_type_unknown: 2045,
          method_not_on_type: 1086,
          polymorphic_no_implementations: 0,
          collection_dispatch_miss: 21,
          dynamic_dispatch: 0,
          no_enclosing_class_scope: 214,
          class_definition_not_found: 0,
          no_parent_class: 5,
          member_type_unknown: 69,
          definition_has_no_body_scope: 0,
          constructor_target_not_a_class: 301,
        },
      },
    },
  ],
  not_measured: [],
  /**
   * Four constructs whose callee is not in the corpus source. No change to
   * annotation, self type, value, member set or subtype closure reaches any of
   * them, so a success criterion stated over these sites can only be met by
   * inventing an edge.
   */
  permanent_limitations: [
    {
      corpus: "webpack/webpack",
      site: "lib/util/hash/wasm-hash.js:141",
      construct: "`exports.update(l)` where `exports` is `instance.exports` on a `WebAssembly.Instance`",
      why: "The callee is a WebAssembly export, compiled from another language and reached through a host object. There is no JavaScript definition in the corpus for the edge to name.",
      registry_candidate: "wasm-export-invocation",
    },
    {
      corpus: "nestjs/nest",
      site: "packages/core/injector/module.ts:111",
      construct: "a DI container keyed by a computed runtime token — `Map<InjectionToken, InstanceWrapper<Injectable>>`",
      why: "The key is a token value assembled at run time, so the wrapper a read returns is chosen by data the source does not state. This is the literal-key case of `dynamic-property-keyed-callback` at container scale.",
      registry_candidate: "dynamic-property-keyed-callback",
    },
    {
      corpus: "celery/celery",
      site: "celery/canvas.py:736",
      construct: "`.on_error(...)` called on the result of an unannotated Python factory",
      why: "The factory declares no return type and constructs nothing the binding can be read from, so the receiver has no type at any rung of the ladder. Typing it needs the value the factory returns at run time.",
      registry_candidate: "untyped-attribute-receiver",
    },
    {
      corpus: "tokio-rs/tokio",
      site: "tokio/src/net/tcp/split_owned.rs:452",
      construct: "`impl Drop for OwnedWriteHalf` — the destructor",
      why: "Rust injects the `drop` call at the end of the value's scope. There is no call expression in the source to index, so the method is unreachable in the call graph however completely the type is resolved.",
      registry_candidate: "rust-compiler-injected-drop",
    },
  ],
};
