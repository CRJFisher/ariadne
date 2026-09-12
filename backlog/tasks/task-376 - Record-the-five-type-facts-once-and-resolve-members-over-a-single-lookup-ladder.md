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

- [ ] #1 All eighteen sub-tasks land in the wave order of the Implementation Plan, each verified by its own criteria before the next wave starts.
- [ ] #2 Every call-kind reference emitted by the index ends as either a resolved call or a recorded `ResolutionFailure`, with the `resolved + failed == call references` invariant asserted in the resolver tier and a per-reason taxonomy reported by the corpus harness (TASK-376.16), before any recovery step lands.
- [ ] #3 Every row of the source plan's §1 probe matrix that reads `receiver_type_unknown`, `member_type_unknown`, `constructor_target_not_a_class` or `polymorphic_no_implementations` today resolves, except the documented permanent limitations.
- [ ] #4 Integration tests (with the fixtures the sub-tasks add) cover every evidence case in the cluster: angular qualified heritage, the CompilerFacade replicas and DI injection, rustc cross-file impl and trait default bodies, sqlx PgCube enum impls, django constructor rows, pandas `_parser_dispatch`, celery constructor-only class / `orig = BaseTask.__call__` / `loops.synloop`, express named member-assigned functions and the mixin pair, mocha element access, webpack accessor pairs and `#`-private chains, and the vscode generic-container dispose shape.
- [ ] #5 The full pipeline is re-run over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha, with per-failure-reason recovery, new false negatives and call-edge deltas reported against the TASK-376.16 baseline and against the TASK-376.17 and TASK-376.13 measurement rows (TASK-376.18).
- [ ] #6 The residue is re-attributed from actual failure reasons rather than the original leaf split, and the permanent limitations (WebAssembly exports object, runtime-token DI containers, celery `canvas.py:736`, Rust `Drop`) are recorded as out of scope.
- [ ] #7 A corpus-level regression suite pins the achieved per-corpus counts with one recorded row and one named end-to-end case per corpus, and the follow-ons (language-aware self-reference keywords, interprocedural cross-function carriers, Python loop-clause scopes) exist as backlog tasks.
- [ ] #8 The insulated suites stay green (`method_lookup.test.ts`, `call_resolver.test.ts`, `collection_dispatch.test.ts`, `constructor*.test.ts`, `path_resolution.rust.test.ts`, `indirect_reachability.test.ts`, `scopes.test.ts`, `preprocess_references.python.test.ts`, the `benchmark_corpus_load` fingerprint guards, the `classify_entry_points` suite), with fixture-level rather than assertion-level adjustments where the graph legitimately changes.

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
14. **TASK-376.13** — rung 5 and the pending-failure index. After step 10 (D) and step 1 (D: the vocabulary; F: `call_resolver.ts`). Owns `method_lookup.ts:139-237` (F: step 6's import branches), `resolution_state.ts` (`remove_files`, `apply_call_resolution`), `call_resolver.ts:342-448`, `project/project.ts:417-427`. Records the post-rung-5 row (M for step 18). Give its session four hours.

**Wave 6** — three steps; steps 15 and 16 both touch Phase 3.5 in `project/project.ts`.

15. **TASK-376.8** — the Rust impl attach pass. After steps 5, 10, 14 (D). Owns the new pass in `project/project.ts` beside `:417-427` (F: step 16), `registries/definition.ts` through `attach_members`.
16. **TASK-376.14** — structural conformance. After steps 5, 10, 14 (D). Owns `call_resolution/structural_conformance.ts`, the interface branch of `method_lookup.ts:167-183`, the pending-interface check in Phase 3.5 (F: step 15). Carries TASK-394's structural half; calibrates the floor on vscode. Give its session four hours.
17. **TASK-376.15** — the type-parameter environment. After step 13 (F: `receiver_resolution.ts`; D on step 8 only). Owns `infer_generic_return_from_type_token` (`receiver_resolution.ts:587-618`).

**Wave 7** — one step.

18. **TASK-376.18** — corpus validation, re-attribution, the regression suite, the follow-on tasks. After steps 15, 16, 17 (D: everything; M: the rows from steps 1, 9, 14). No production code beyond the recorded rows and the named end-to-end cases. Give its session six hours for the ten interleaved corpus pairs.

The critical path is steps 1 → 8 → 9 → 10 → 14 → 15/16 → 18, seven sessions deep; the widest wave is six.

<!-- SECTION:PLAN:END -->
