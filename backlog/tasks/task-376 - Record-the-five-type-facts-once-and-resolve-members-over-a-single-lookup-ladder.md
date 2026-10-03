---
id: TASK-376
title: "Record the five type facts once and resolve members over a single lookup ladder"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - collection_dispatch
  - scope_construction
  - method_lookup
  - polymorphic_dispatch
  - receiver_type_inference
dependencies: []
priority: high
plan_dedup_keys:
  - 7498087703ce0215e9de047d396cc223ba1d8440750ab8aaac9f23da28b5690a
  - d159a50db87987e413ad8d225e400caa265f3ab15e4598a435bef5c625c7d0f3
  - c1a6bc42624ddeac1aaf6538338cf8940cd4c002cb1ffe8fabdafd62b7f52f4e
  - d8d3b9b0f2083357f27335c310ecaf87d0153a3606a4db203793a1f721e67ca7
  - 39a016350e3e1f6dda8318cbc86557d00789200f7adbe83f1b734ce27223780d
plan_source_tasks:
  - pt-3a330ed26f760de5
  - pt-41336db4fec546b0
  - pt-635ae320951bcbfe
  - pt-7785241509a2f0c1
  - pt-b3b3f179aab8441a
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A receiver-directed call needs five facts: what a name's **annotation** denotes, what type a scope's **`self`** binds to, what a **binding holds**, what a type's **full member set** is, and which types are its **subtypes**. None is recorded. Each is re-derived at the point of use, from raw source text or a lossy projection, by two or three drifting builders, and each builder's gaps are a different population of false positives. `call_resolution/method_lookup.ts:139-157` is the sink where all five arrive.

- **Annotation** — `resolve` (`resolve_references/resolution_state.ts:134-141`) looks a bare declared name up along the scope's parent chain, and six sites hand it raw annotation text with no parse (`registries/type.ts:161`, `:218`, `:246`; `call_resolution/receiver_resolution.ts:285`, `:498`, `:661`). An annotation resolves only if its source text is byte-identical to a declared name: Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit` fail; TypeScript `F | null` fails; Python `Optional[C]`, `Union[C, None]`, `"C"` fail; JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` fail. 1049 of 1149 `receiver_type_inference` rows are this one defect.
- **Self type** — `LexicalScope` has no field for it, so `find_class_from_scope` (`receiver_resolution.ts:738-767`) runs the member index backwards and fails four reproduced ways (getter/setter id split, constructor-only class and constructor bodies, cross-file Rust `impl` contributing zero definitions, first-candidate break). The fifth mode the plan recorded — enums with no member index — closed with TASK-374.
- **Value** — there is a type channel and a call-target channel and no answer to "what does this binding hold?", so `resolve_identifier_base` returns `receiver_type_unknown` (`receiver_resolution.ts:303-309`) and `resolve_constructor_call` returns `constructor_target_not_a_class` (`constructor.ts:85-97`) for class aliases, factory returns and element reads.
- **Member set** — three builders (`registries/definition.ts:229-279`, `type_preprocessing/member.ts:65-148`, `registries/type.ts:267-314`); the live one is written once per type definition, so a type's members come only from its declaring file, and a cross-file Rust `impl` contributes nothing.
- **Subtype graph** — populated by two builders plus `TypeRegistry` STEP 3, missing qualified TypeScript heritage, dotted Python bases, every Rust trait edge, every structural conformance, every base past the first, and — on the incremental driver — every edge whose caller file resolved before the implementer file arrived.

## Work plan

Record each fact once in the store that owns it, and give member lookup one ladder over those stores. The eighteen sub-tasks are the fifteen leaves of the source plan's §7 plus three steps that were epic-level work and are now steps of the chain: TASK-376.16 (§7 step 7, diagnostic completeness and the failure-taxonomy harness), TASK-376.17 (the second half of §7 step 6, the `symbol_types` split and the dead-builder deletions) and TASK-376.18 (§7 step 17, corpus validation). The Implementation Plan below is the work order; it groups the sub-tasks into seven waves, each wave's steps independent of each other, and names what pins every step.

1. **Diagnostic completeness and the baseline, first** (TASK-376.16). Every call-kind reference ends as a resolved call or a recorded `ResolutionFailure`, the invariant is asserted in the resolver tier, and the `benchmark_corpus_load` harness reports a per-reason failure taxonomy per arm. Its landed tree carries the pre-epic baseline row per corpus. This is what makes every later step measurable.
2. **Measurement at the two fan-out points.** TASK-376.17 records the call-edge and per-reason deltas on angular, django, rustc and pandas after the annotation resolver, and TASK-376.13 records them again after rung 5 — making interface and abstract-class annotations resolve hands `method_lookup` far more receivers, and rung 5 fans a common name (`save`, `run`, `process`) to every subtype declaring it. `method_lookup.ts:159-165`'s constructor exclusion is the precedent if a guard proves necessary.
3. **Corpus validation and re-attribution, last** (TASK-376.18): the full pipeline over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha; recovery per failure reason against the baseline and against the two measurement rows; new false negatives by literal set difference; the residue re-attributed from actual failure reasons; the permanent limitations recorded; and the follow-ons filed as backlog tasks.
4. **Integration tests across the epic.** Each sub-task lands its own integration tests; the epic is complete only when the source plan's §1 probe matrix is a passing suite at the `Project` + `update_file` tier, covering every evidence corpus concretely: angular (`o.TypeVisitor` implementers, `abstract_form.directive.ts:63,68` accessor pair, `lexer.ts:116` nested `new`, the `CompilerFacade` replica cluster, DI `inject(Router)`), rustc (`rustc_ast_lowering` cross-file `impl LoweringContext`, trait default-body dispatch), tokio and sqlx (`PgCube` enum `impl` blocks, `self.header().encoded_size()`), TypeScript, django (constructor rows), pandas (`_parser_dispatch` factory), celery (`certificate.py:100` constructor-only class, `orig = BaseTask.__call__`, `loops.synloop`), express (`lib/application.js:294` named member-assigned functions, the `require` + `mixin` pair), mocha (`@param {Suite[]} suites` + `suites[0].afterEach()`, `var s = suites[0]`), webpack (`lib/Module.js:304`/`:317` accessor pair, `this.#tm.getTransaction()`) and vscode (`DisposableMap<string, IEditorContribution>` element dispose, TASK-394). Fixtures live under `packages/core/tests/fixtures/{typescript,javascript,rust,python}/code/integration/`; the rust and python directories do not exist yet and are created by the first step that needs them.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 All eighteen sub-tasks land in the wave order of the Implementation Plan, each verified by its own criteria before the next wave starts.
      Evidence: all eighteen sub-tasks (TASK-376.1 to TASK-376.18) are `Done` with every one of their own criteria ticked. The merge log holds the wave order: TASK-376.16, .1, .2, .3, .4, .12 merge first (`ff490892` to `fd24216d`); .5 and .6 follow (`2818cf0d`, `47fc5be1`); TASK-376.17 lands after .6 (`94a2a259`); .7 and .9 follow it (`339a58a1`, `f78c4706`); .10, .11 and .13 follow those (`555f74bc`, `9265c4c4`, `d835aca6`); .14, .15 and the TASK-376.8 confirmation land after .13 (`4d1b126c`, `930fc83b`, `5908e83b`); TASK-376.18 lands last (`7671d944`). TASK-376.8's pass was written inside TASK-376.7's and TASK-376.13's commits and its own step confirmed it after TASK-376.13, as its notes record.
- [x] #2 Every call-kind reference emitted by the index ends as either a resolved call or a recorded `ResolutionFailure`, with the `resolved + failed == call references` invariant asserted in the resolver tier and a per-reason taxonomy reported by the corpus harness (TASK-376.16), before any recovery step lands.
      Evidence: `call_resolver.test.ts` › "resolved-plus-failed invariant" asserts `resolved + failed == call references` over the committed fixture corpus at the resolver tier. The per-reason taxonomy is reported by `run_load_benchmark.ts --interleave` and recorded per corpus in `recorded_failure_taxonomy_baseline.ts`, measured on `a3d5beea`. None of the recovery steps (TASK-376.1, .2, .3, .4, .5, .6, .7, .9, .10, .11, .12, .13, .17) is an ancestor of `a3d5beea`, so the baseline precedes every recovery step. All ten close-out arms close over their call references (`resolved + failed == call_references`), which `read_arm_result` enforces on read.
- [x] #3 Every row of the source plan's §1 probe matrix that reads `receiver_type_unknown`, `member_type_unknown`, `constructor_target_not_a_class` or `polymorphic_no_implementations` today resolves, except the documented permanent limitations.
      Evidence: the probe matrix's rows are the five facts' probes in the source plan's §1: each annotation form (Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit`; TypeScript `F | null`; Python `Optional[C]`, `Union[C, None]`, `"C"`; JSDoc `{X=}`, `{X|null}`, `{import("./a").X}`) is a passing case in `annotation.{typescript,python,rust}.test.ts` and `type.integration.test.ts`; the four self-type failure modes, the cross-file Rust `impl`, the enum `impl` blocks, the value rows (`mapper_cls = Mapper`, `cls = Parser`, `make()` returning `type[Parser]`, `orig = BaseTask.__call__`, `_parser_dispatch`, `suites[0]`) in `receiver_resolution.*.integration.test.ts`, `value_source.test.ts`, `container_element.test.ts` and `project.corpus_evidence.integration.test.ts`; and the subtype-graph rows (qualified heritage, bases past the first, Rust trait edges, structural conformance, the six ingestion orders) in `type.integration.test.ts` and `project.integration.test.ts`. The full suite is green on the merged tree (`235` files, `5383` tests), so every one of those passes. The four permanent limitations stay out of scope as `RECORDED_CORPUS_RESOLUTION.permanent_limitations` records them. The vscode `_register(new DisposableMap<…>())` field is TASK-394's shape, not a matrix row, and is carried under #4.
- [ ] #4 Integration tests (with the fixtures the sub-tasks add) cover every evidence case in the cluster: angular qualified heritage, the CompilerFacade replicas and DI injection, rustc cross-file impl and trait default bodies, sqlx PgCube enum impls, django constructor rows, pandas `_parser_dispatch`, celery constructor-only class / `orig = BaseTask.__call__` / `loops.synloop`, express named member-assigned functions and the mixin pair, mocha element access, webpack accessor pairs and `#`-private chains, and the vscode generic-container dispose shape.
- [x] #5 The full pipeline is re-run over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha, with per-failure-reason recovery, new false negatives and call-edge deltas reported against the TASK-376.16 baseline and against the TASK-376.17 and TASK-376.13 measurement rows (TASK-376.18).
- [x] #6 The residue is re-attributed from actual failure reasons rather than the original leaf split, and the permanent limitations (WebAssembly exports object, runtime-token DI containers, celery `canvas.py:736`, Rust `Drop`) are recorded as out of scope.
- [x] #7 A corpus-level regression suite pins the achieved per-corpus counts with one recorded row and one named end-to-end case per corpus, and the follow-ons (language-aware self-reference keywords, interprocedural cross-function carriers, Python loop-clause scopes) exist as backlog tasks.
- [x] #8 The insulated suites stay green (`method_lookup.test.ts`, `call_resolver.test.ts`, `collection_dispatch.test.ts`, `constructor*.test.ts`, `path_resolution.rust.test.ts`, `indirect_reachability.test.ts`, `scopes.test.ts`, `preprocess_references.python.test.ts`, the `benchmark_corpus_load` fingerprint guards, the `classify_entry_points` suite), with fixture-level rather than assertion-level adjustments where the graph legitimately changes.
      Evidence: `cd packages/core && npx tsc --noEmit && npx vitest run` passes on `5acc366a`: 235 files, 5383 tests, 1 todo. Run separately, the named insulated suites (`method_lookup`, `call_resolver`, `collection_dispatch`, `constructor*`, `path_resolution.rust`, `indirect_reachability`, `scopes`, `preprocess_references.python`, all of `benchmark_corpus_load/` including the fingerprint guards, all of `classify_entry_points/`) pass: 73 files, 929 tests. Over the epic's commits, none of those nine test files has an `expect` assertion line removed; the 40 lines removed from `method_lookup.test.ts` are the `resolve_method_on_type` call signature, its `register_subtype` setup, and one case title ("…implements or conforms to"); the case's fixture, not its assertion, carries the structural-conformance change.

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

The source plan is `~/.ariadne/prioritize/20260728T221135Z/clusters/type-model-completion/consolidated_plan.md`; its §1 probe matrix, §6 row mapping and §8 test plan remain the reference for evidence and fixtures, and its §7 order is superseded by the waves below. Every sub-task's citations name the tree at `279221d4`; a citation is a pointer to a function and is re-read before use. The `.overview.html` beside this file is the source plan's comprehension doc and describes its fifteen-step order.

Three facts the source plan asked for are recorded in the tree: a named member-assigned function's collection id is the definition's id (TASK-374.1, commit `cd7ff669`; TASK-376.1 carries the assertions), enums enter the member index (TASK-374, commit `369cd81c`), and the star / `pub use` / wildcard export edge exists (TASK-375), which TASK-376.12 consumes.

### Rules for every step

- One step per session, in a worktree branched from the integration branch (`feat/self-healing-pipeline-debug`), merged back when its acceptance criteria pass. A wave's steps run concurrently in separate worktrees and merge in slot order; a merge conflict is resolved by a session against the task doc, never by dropping either side.
- No step in this epic measures time, so concurrency costs wall clock only. Cap a wave's width at what the box tolerates running the `packages/core` suite in parallel; a wave wider than the cap simply queues.
- The task doc is the spec. A line number is a pointer to a function, not a fact: a session re-reads the cited function before editing and corrects the doc's citation in its own commit when it has moved.
- Every corpus figure comes from TASK-376.16's taxonomy harness, from a control arm and a candidate arm interleaved in the same session on the same box, over the corpus checkouts under `~/.ariadne/triage-entrypoints/repos/`. No figure is quoted from the source plan, and no corpus-scale claim is made from a slice.
- Tests follow `.claude/rules/testing.md`: `build_index_single_file` inline for a recording-side fact, `Project` + `update_file` and the bulk driver (`ingest_file` × N then `resolve_corpus`) for resolution, `toEqual` against typed literals, and fixture-level rather than assertion-level adjustment of an insulated suite. A guard that passes on the tree before its step does not count.
- A step's assertion is `cd packages/core && npx tsc --noEmit && npx vitest run`, run once before the report; the Stop hooks (stage boundaries, dead code, file naming) run on the session's changes.
- Commits are task-scoped: `feat(376.N): …`, `fix(376.N): …`, `test(376.N): …`, per `.claude/rules/commit-convention.md`.
- A step's session is one shot: nothing re-invokes it, no work is backgrounded, and the session ends only by reporting its result with its criteria ticked and its commits in the tree.

### Order

Each step names what pins it: a dependency (D), a file shared with an earlier or concurrent step (F), or a measurement it needs from an earlier step (M). Steps inside one wave are independent of each other.

**Wave 1** — six independent steps.

1. **TASK-376.16** — diagnostic completeness and the failure-taxonomy harness. First, because nothing later is measurable until every dropped call reference carries a reason. Owns `call_resolution/call_resolver.ts`, `benchmark_corpus_load/`. Records the baseline row per corpus on its landed tree; give its session four hours for the ten corpus runs.
2. **TASK-376.1** — collection member ids. Assertions only; the fix landed. Owns the `symbol_factories.javascript.ts` tests and one JavaScript integration case.
3. **TASK-376.2** — Python constructor heuristic deletion, STEP 1 type-kind guard, `extract_type_data` order. Owns `queries/python.scm` (`:651-693`; F with step 6, different region), `registries/type.ts` STEP 1 (F with step 8, which keeps the guard), `preprocess_references.python.ts`.
4. **TASK-376.3** — `LexicalScope.self_type_name`. Owns `packages/types/src/lexical_scope.ts`, `scopes/boundary_base.ts`, `scopes/scopes.ts` (`:140-195`), the four boundary extractors (F with step 6 on `python_scope_boundary_extractor.ts`, different method).
5. **TASK-376.4** — provenanced member-index union, `members_by_name`, `get_member_closure`. Owns `registries/definition.ts` member indices (F with step 10, which owns its heritage half).
6. **TASK-376.12** — `resolve_module_member` and the Python guard-clause scopes. Owns `resolve_references/export_chain_lookup.ts`, the three import-shaped branches of `method_lookup.ts` (F with step 14), `queries/python.scm` (`:73-83`), `python_scope_boundary_extractor.ts`.

**Wave 2** — two steps sharing `receiver_resolution.ts` in different functions.

7. **TASK-376.5** — `find_self_type`. After step 4 (D). Owns `resolve_keyword_base` and the two deleted scans in `receiver_resolution.ts`, `path_resolution.rust.ts:286-299`, `scopes/scopes.ts:249-266`, `scopes/processing_context.ts`.
8. **TASK-376.6** — the annotation parser, `resolve_annotation`, the six call sites, `symbol_type_arguments`, STEP 1b folded. After step 3 (F: STEP 1) and step 1 (M: the taxonomy). Owns `type_preprocessing/annotation*.ts`, `registries/type.ts` STEP 1 / 1b / 1.5 / 3 call sites, `constructor_bindings.ts`, and in `receiver_resolution.ts` the two fallbacks, `parse_single_type_argument` and the raw sites at `:285`, `:498`, `:661` (F with step 7). Give its session four hours.

**Wave 3** — one step, alone, because it reshapes the file three wave-4 steps edit.

9. **TASK-376.17** — the `symbol_types` split, `callable_return_types`, `bindings.ts` split, deletion of `extract_type_members` / `get_type_members` / `get_type_info` / `TypeMemberInfo`. After step 8 (D). Owns `registries/type.ts` maps and STEP 2, `type_preprocessing/bindings.ts`, `member.ts`, `index.ts`, `project/project.ts:707-714`, `walk_property_chain`, `packages/types/src/type_member_info.ts`. Records the post-annotation row on angular, django, rustc and pandas (M for step 14). Give its session four hours.

**Wave 4** — three steps.

10. **TASK-376.7** — single heritage builder, `parent_types`, BFS chain, STEP 3 deleted. After step 9 (D: `resolve_annotation`; F: `type.ts`). Owns `registries/definition.ts` heritage (F: step 5's member half), `registries/type.ts` STEP 3 / `walk_inheritance_chain` / `get_type_member` (F: steps 11-12), `symbol_factories.typescript.ts:209-274`, `capture_handlers/methods.rust.ts`, `MethodDefinition` in `symbol_definitions.ts` (F: step 11, `VariableDefinition`). Closes TASK-374.4. Give its session four hours.
11. **TASK-376.9** — construction and initialiser capture. After step 9 (D: `resolve_annotation`, the split store; F: `type.ts` STEP 1.5). Owns `metadata_extractors.javascript.ts:214-329`, `symbol_factories.{javascript,rust,python}.ts` initialiser extractors, `capture_handlers.python.ts:478-490`, both `extract_jsdoc_type`s, `VariableDefinition`. Closes TASK-374.6 item 3. Give its session four hours for the four Python corpus runs.
12. **TASK-376.10** — element types, `index_access`, the non-callable guard, the container mistyping removed. After step 9 (D: `symbol_type_arguments`, `walk_property_chain`). Owns `extract_receiver` / `ReceiverExpression` / `resolve_identifier_base`'s element hop in `receiver_resolution.ts`, `collection_dispatch.ts:216-255`, `constructor_bindings.ts:38-44`. Carries TASK-394's container half.

**Wave 5** — two steps, disjoint files.

13. **TASK-376.11** — `value_source.ts` and its four consumers. After steps 9, 11, 12 (D). Owns the new file, `receiver_resolution.ts:303-309`, `constructor.ts:85-97`, `function_call.ts:143-152`, `indirect_reachability.ts:98-152`.
14. **TASK-376.13** — rung 5 and the subtype-dispatch index (`ResolutionState.subtype_dispatch_files`: every file whose lookup enumerated a type's subtype closure, resolved or not). After step 10 (D) and step 1 (D: the vocabulary; F: `call_resolver.ts`). Owns `method_lookup.ts:139-237` (F: step 6's import branches), `resolution_state.ts` (`remove_files`, `apply_call_resolution`), `call_resolver.ts:342-448`, `project/project.ts:417-427`. Records the post-rung-5 row (M for step 18). Give its session four hours.

**Wave 6** — three steps; steps 15 and 16 both touch Phase 3.5 in `project/project.ts`.

15. **TASK-376.8** — the Rust impl attach pass. After steps 5, 10, 14 (D). Owns the new pass in `project/project.ts` beside `:417-427` (F: step 16), `registries/definition.ts` through `attach_members`.
16. **TASK-376.14** — structural conformance. After steps 5, 10, 14 (D). Owns `call_resolution/structural_conformance.ts`, the interface branch of `method_lookup.ts:167-183`, the pending-interface check in Phase 3.5 (F: step 15). Carries TASK-394's structural half; calibrates the floor on vscode. Give its session four hours.
17. **TASK-376.15** — the type-parameter environment. After step 13 (F: `receiver_resolution.ts`; D on step 8 only). Owns `infer_generic_return_from_type_token` (`receiver_resolution.ts:587-618`).

**Wave 7** — one step.

18. **TASK-376.18** — corpus validation, re-attribution, the regression suite, the follow-on tasks. After steps 15, 16, 17 (D: everything; M: the rows from steps 1, 9, 14). No production code beyond the recorded rows and the named end-to-end cases. Give its session six hours for the ten interleaved corpus pairs.

The critical path is steps 1 → 8 → 9 → 10 → 14 → 15/16 → 18, seven sessions deep; the widest wave is six.

<!-- SECTION:PLAN:END -->

<!-- SECTION:NOTES:BEGIN -->

## Close-out measurement

### Method

Ten corpora, each run as an interleaved control, candidate, control, candidate quartet by `run_load_benchmark.ts --interleave` in one session on one box (Darwin 24.6.0, 6 CPUs, 32,768 MB, node v22.22.1). The control is `038b7daa`, the tree TASK-376.18 recorded its achieved row on, checked out beside this tree with its `node_modules` and `dist` rebuilt; the four harness files that size an arm's heap (`benchmark_corpus_load.ts`, `heap_requirement.ts`, `ingest_order.ts`, `nested_slice.ts`) are this tree's, so the control measures TypeScript under the guard TASK-376.18 introduced. The candidate is `5acc366a`, the merged tree. The corpora are the checkouts under `~/.ariadne/triage-entrypoints/repos/`, at TASK-376.18's commits and predicates; the arms are in `~/.ariadne/benchmark-runs/task-376-close-out/`.

Two properties make the figures a measurement of the tree rather than of the session. Each arm's two runs agree on all seven fingerprint components and on the taxonomy, on all ten corpora. Each control arm reproduces TASK-376.18's recorded row exactly (all seven components and every taxonomy count), so the recorded rows below are restated from this session's control arms and the candidate columns are deltas against them.

### TASK-376.18's achieved row, restated, against the merged tree

| Corpus     |       Call refs |                     Resolved |                   Call edges |         Raw entry points |
| ---------- | --------------: | ---------------------------: | ---------------------------: | -----------------------: |
| angular    | 378862 → 379504 | 160166 → **171504** (+11338) | 158057 → **168723** (+10666) |   3096 → **2893** (-203) |
| rustc      |      325188 (=) |  113204 → **114580** (+1376) |    96180 → **97911** (+1731) | 19732 → **19479** (-253) |
| tokio      |       34860 (=) |       8813 → **8980** (+167) |       7762 → **7895** (+133) |    2363 → **2339** (-24) |
| sqlx       |       18564 (=) |        4033 → **4085** (+52) |       3597 → **3699** (+102) |    1524 → **1461** (-63) |
| TypeScript | 153090 → 153149 |     93358 → **93835** (+477) |     75036 → **75611** (+575) |      758 → **727** (-31) |
| django     | 202972 → 203049 |     85878 → **86126** (+248) |      67102 → **67057** (-45) |    2289 → **2279** (-10) |
| pandas     | 244360 → 244338 |    117951 → **117915** (-36) |      84238 → **84168** (-70) |      2085 → **2085** (=) |
| celery     |   35088 → 35090 |     11254 → **11357** (+103) |        9465 → **9549** (+84) |      730 → **717** (-13) |
| express    |       14543 (=) |                     5436 (=) |                     5250 (=) |                   21 (=) |
| mocha      |       19965 (=) |         7485 → **7487** (+2) |         6936 → **6938** (+2) |         71 → **70** (-1) |

The left of each cell is `recorded_corpus_resolution.ts` as pinned: the regression suite's call-edge and raw-entry-point rows hold the left-hand figures, and they remain the rows a later change is judged against. The nodes held are identical on both trees on every corpus.

### Per-reason recovery against the achieved row

Only the reasons that moved by any amount on some corpus; `0` is no movement. A reason rising is not a regression by itself: a receiver that stops failing at `receiver_type_unknown` fails later, at `member_type_unknown`, `method_not_on_type` or `polymorphic_no_implementations`.

| Corpus     | `name_not_in_scope` | `receiver_type_unknown` | `method_not_on_type` | `member_type_unknown` | `polymorphic_no_implementations` | `collection_dispatch_miss` | `no_enclosing_class_scope` | `class_definition_not_found` | `constructor_target_not_a_class` | `no_parent_class` |
| ---------- | ------------------: | ----------------------: | -------------------: | --------------------: | -------------------------------: | -------------------------: | -------------------------: | ---------------------------: | -------------------------------: | ----------------: |
| angular    |                 +21 |              **-12220** |                  +71 |                  +867 |                             +581 |                         +6 |                        -22 |                            0 |                                0 |                 0 |
| rustc      |                 +63 |                    -476 |                 +283 |             **-1195** |                               +4 |                         +1 |                        -43 |                          -13 |                                0 |                 0 |
| tokio      |                  +4 |                     -58 |                  +39 |                   -86 |                               +2 |                          0 |                         -1 |                          -63 |                                0 |                -4 |
| sqlx       |                  +7 |                     -43 |                  +49 |                   -57 |                                0 |                          0 |                         -8 |                            0 |                                0 |                 0 |
| TypeScript |                  +1 |               **-1138** |                  +50 |                  +117 |                             +573 |                          0 |                        -11 |                            0 |                              -10 |                 0 |
| django     |                 -49 |                    -169 |                 +183 |                  -123 |                                0 |                        +22 |                        -35 |                            0 |                                0 |                 0 |
| pandas     |            **-568** |                **+654** |                  -26 |                    -1 |                                0 |                          0 |                        -45 |                            0 |                                0 |                 0 |
| celery     |                  -3 |                    -124 |                  +18 |                   +41 |                                0 |                          0 |                        -33 |                            0 |                                0 |                 0 |
| express    |                   0 |                       0 |                    0 |                     0 |                                0 |                          0 |                          0 |                            0 |                                0 |                 0 |
| mocha      |                   0 |                     +54 |                    0 |                     0 |                                0 |                          0 |                        -56 |                            0 |                                0 |                 0 |

`import_unresolved`, `reexport_chain_unresolved`, `dynamic_dispatch` and `definition_has_no_body_scope` do not move on any corpus. angular is the recovery: `receiver_type_unknown` falls by 12,220 and 11,338 more calls resolve, with the unresolved remainder moving to `member_type_unknown` (+867) and `polymorphic_no_implementations` (+581) because a receiver that now has a type reaches the member lookup. rustc, TypeScript, tokio and sqlx recover the same way at smaller scale. pandas does not recover: 654 more call references fail at `receiver_type_unknown` while 568 fewer fail at `name_not_in_scope`, and `resolved` falls by 36.

### Set difference, named

The literal difference over the complete member lists, candidate against the achieved row. Neither containment TASK-376.18 stated holds literally on every corpus, and the report does not net it.

| Corpus     | Edge pairs only in the achieved row | Edge pairs only now | Entry points only in the achieved row | Entry points only now |
| ---------- | ----------------------------------: | ------------------: | ------------------------------------: | --------------------: |
| angular    |                                   5 |               10671 |                                   203 |                     0 |
| rustc      |                                 401 |                2132 |                                   310 |                **57** |
| tokio      |                                   0 |                 133 |                                    24 |                     0 |
| sqlx       |                                   0 |                 102 |                                    63 |                     0 |
| TypeScript |                                  89 |                 664 |                                    31 |                     0 |
| django     |                                 542 |                 497 |                                    10 |                     0 |
| pandas     |                                 129 |                  59 |                                     0 |                     0 |
| celery     |                                  12 |                  96 |                                    13 |                     0 |
| express    |                                   0 |                   0 |                                     0 |                     0 |
| mocha      |                                  80 |                  82 |                                     1 |                     0 |

**Entry points gained: 57, all on rustc.** Every other corpus gains none. A sampled site is `compiler/rustc_borrowck/src/lib.rs:1385`, `this.report_move_out_while_borrowed(...)`, where `this` is a closure parameter in `each_borrow_involving_path(..., |this, …| …)`: the closure receives `&mut Self` from its callee's bound, and the receiver is no longer read as `self`. This is the `|this|` idiom TASK-376.25 recorded as the cost of reading a self keyword by language, and it is the callback-parameter typing TASK-376.28 begins; other sampled gained entry points (`conflict_errors.rs:1824` `explanation.is_explained()`, a local bound from a method's return) have a different cause that is not attributed here.

**Edges only in the achieved row, by mechanism.** The corpora where the count is non-zero, split by what the control edge's callee became:

- **A call through a callable-valued local now reaches the function it holds, not the binding.** 80 of mocha's 80 (`doc.spec.cjs:102` → `runReporter`, a `const` binding), 296 of django's 542, 64 of TypeScript's 89, 12 of celery's 12, 5 of angular's 5, 11 of pandas's 129, 2 of rustc's 401. mocha, django and TypeScript gain function-kind edges (80, 370 and 63); celery's 12 and pandas's 11 (`nb_looper = generate_apply_looper(...)`, `depr_func = deprecate(...)`) are factory results with no function to retarget to, so those edges are lost and no entry point changes.
- **A `self`/`this` fan-out narrows to the receiver's own closure.** django 131, TypeScript 19, pandas 18: the same caller keeps an edge to the same-named member, on fewer subtypes.
- **A call with no same-named edge left from its caller.** rustc 392 (the closure `|this|` receivers above), django 111, pandas 99, TypeScript 6.
- **A method recorded as calling itself.** 5 on rustc, 4 on django, 1 on pandas, each a self-edge the achieved row held.

**Entry points only in the achieved row (removed), spot-verified at their call sites.** angular removes 203; sampled: `top-level-banner.component.spec.ts:106` `component.close()`, `search-history.service.spec.ts:105` `service.removeItem(bItem)`. TypeScript: `src/harness/vfsUtil.ts:1262` `getBuiltLocal(host, ignoreCase).shadow()`, `src/harness/sourceMapRecorder.ts:65` `jsFile.lineStarts` (the getter). django: `django/db/migrations/operations/fields.py:103` `state.add_field(...)`, `tests/migrations/test_autodetector.py:4029` `to_state.get_concrete_model_key(...)`. mocha: `lib/interfaces/common.js:133` `suite.markOnly()`. Every sampled removal is a real call.

### Residue and the two earlier measurement rows

The residue's composition is TASK-376.18's: the dominant share on every corpus is a callee outside the indexed file set, and the reasons that are the resolver's moved by the amounts above. The re-attribution table in TASK-376.18 stands; the only reason whose owner this measurement changes is the 57 rustc entry points, owned by `receiver_type_inference` (the callee-declared closure-parameter type). TASK-376.17's post-annotation row and TASK-376.13's post-rung-5 row were measured on angular, django, rustc and pandas against different controls and a different call universe, so no delta is taken across them; the achieved row is the one both end on.

### What is left open

- **#4 is not ticked.** Every evidence case in the criterion has a passing integration test except the vscode generic-container dispose shape as the corpus writes it. `container_elements/contributions.ts` annotates its field and says why: `container_element.test.ts` › "typescript (vscode DisposableMap)" resolves `instance.dispose()` and `this._instances.get(id)!.dispose()` against `IEditorContribution` only because the field is declared `DisposableMap<string, IEditorContribution>`. Probed on this tree with the real field `_instances = this._register(new DisposableMap<string, IEditorContribution>())`: the `for (const [, instance] of this._instances)` dispose call fails `type_inference/receiver_type_unknown` and `this._instances.get(id)!.dispose()` fails `type_inference/member_type_unknown`. Dropping `_register` still leaves the iteration failing. TASK-376.15 records the three indexing facts the shape needs (a class field keeps no call initialiser, a construction argument that is not an identifier occupies its position as `null`, and a container's element is read from a binding's own annotation, not from a bound type parameter's arguments), and TASK-394, still `To Do`, carries all eleven sites.
- **pandas** resolves 36 fewer calls than the achieved row and gains 654 `receiver_type_unknown`, with no entry point changing; the 70 lost edges are in the mechanism list above.

<!-- SECTION:NOTES:END -->
