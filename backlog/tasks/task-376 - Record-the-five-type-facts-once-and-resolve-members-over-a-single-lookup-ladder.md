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

A receiver-directed call needs five facts: what a name's **annotation** denotes, what type a scope's **`self`** binds to, what a **binding holds**, what a type's **full member set** is, and which types are its **subtypes**. None is recorded. Each is re-derived at the point of use, from raw source text or a lossy projection, by two or three drifting builders, and each builder's gaps are a different population of false positives. `call_resolution/method_lookup.ts:132-138` is the sink where all five arrive.

- **Annotation** — `ResolutionRegistry.resolve` (`resolve_references/resolution_state.ts:90-96`) is a two-level `Map` keyed on bare declared names, and six sites hand it raw annotation text with no parse (`registries/type.ts:161`, `:218`, `:246`; `call_resolution/receiver_resolution.ts:278`, `:346`, `:460`). An annotation resolves only if its source text is byte-identical to a declared name: Rust `&S`, `&mut S`, `Option<Enc>`, `Box<dyn Emit>`, `impl Emit` fail; TypeScript `F | null` fails; Python `Optional[C]`, `Union[C, None]`, `"C"` fail; JSDoc `{ChunkGraph=}`, `{ChunkGraph|null}`, `{import("./a").X}` fail. 1049 of 1149 `receiver_type_inference` rows are this one defect.
- **Self type** — `LexicalScope` has no field for it, so `find_class_from_scope` (`receiver_resolution.ts:542-574`) runs the member index backwards and fails five reproduced ways (getter/setter id split, constructor-only class, enums with no member index, cross-file Rust `impl` contributing zero definitions, first-candidate break).
- **Value** — there is a type channel and a call-target channel and no answer to "what does this binding hold?", so `resolve_identifier_base` returns `receiver_type_unknown` (`receiver_resolution.ts:282-288`) and `resolve_constructor_call` returns `constructor_target_not_a_class` (`constructor.ts:87-95`) for class aliases, factory returns and element reads.
- **Member set** — three builders (`registries/definition.ts:123-164`, `type_preprocessing/member.ts:60-143`, `registries/type.ts:267-311`); the live one is `set` per class per file and excludes enums.
- **Subtype graph** — built three times, missing qualified TypeScript heritage, every Rust trait edge, every structural conformance, every base past the first, and every edge whose caller file resolved before the implementer file was ingested.

## Work plan

Record each fact once in the store that owns it, and give member lookup one ladder over those stores. The plan's §7 work order is strict — later steps delete or reshape what earlier steps establish, and each de-noises the measurement of the next. §7 steps 1-6 and 8-16 are the fifteen sub-tasks of this epic, in order; §7 steps 7 (diagnostic completeness) and 17 (corpus validation) are cross-cutting measurement work and are done **here**, on the epic, because they span every row rather than any one leaf. §7 steps 1, 2, 3, 4 and the diagnostic work below are mutually independent; step 6 gates 8-16; step 8 gates 14 and 15.

1. Sequence the sub-tasks in §7 order and hold the order: collection member ids → Python constructor-capture deletion → `self_type_name` → member-index completeness → `find_self_type` → the annotation resolver → heritage → Rust impl attachment → construction capture → element types → the value channel → module-surface consumers → ladder rung 5 → structural conformance → type-parameter binding.
2. **Diagnostic completeness (§7 step 7), before the later sub-tasks land.** Audit `call_resolution/call_resolver.ts` and every `resolve_*` path in `call_resolution/` for references that return without either a resolved target or a recorded `ResolutionFailure`. Emit a typed failure at each such exit, reusing the existing vocabulary (`receiver_type_unknown`, `member_type_unknown`, `method_not_on_type`, `name_not_in_scope`, `constructor_target_not_a_class`, `polymorphic_no_implementations`, `collection_dispatch_miss`) and adding a reason only where none describes the drop. Assert the invariant in the resolver tier: for a given file, `resolved_calls + failures == call references emitted by the index`. This is cheap, independent of steps 1-6, and it is what makes §7 steps 8-16 measurable.
3. Take a pre-epic baseline per corpus and per failure reason using that instrumentation, and measure call-edge count deltas after the annotation resolver (§7 step 6) and again after ladder rung 5 (§7 step 14) — making interface and abstract-class annotations resolve hands `method_lookup` far more receivers, and rung 5 fans a common name (`save`, `run`, `process`) to every subtype declaring it. `method_lookup.ts:140-146`'s constructor exclusion is the precedent if a guard proves necessary.
4. **Corpus validation and re-attribution (§7 step 17), after the last sub-task.** Re-run the full pipeline over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha; report recovery per failure reason against the baseline **and** new false negatives; re-attribute the residue from the actual failure reasons rather than the original leaf split; and record the permanent limitations that success criteria must not target — `wasm-hash.js:141` calling `exports.update()` on a `WebAssembly.Instance` exports object, DI containers keyed by computed runtime tokens in `Map<InjectionToken, InstanceWrapper>`, celery `canvas.py:736` (`.on_error(...)` off an unannotated Python factory), and the Rust `Drop` rows, whose destructor call is compiler-injected with no call expression in source.
5. Record the follow-ons this epic deliberately does not close: making `SELF_REFERENCE_KEYWORDS` (`receiver_resolution.ts:80`) language-aware or preferring an in-scope binding (Rust `this` is an ordinary identifier; JavaScript `self` is a real global, used heavily by webpack), and interprocedural dataflow for cross-function class carriers (Django's `form_class(**defaults)`).
6. **Integration tests across the epic.** Each sub-task lands its own integration tests; the epic is complete only when the §1 probe matrix is a passing suite at the `Project` + `update_file` tier, covering every evidence corpus concretely: angular (`o.TypeVisitor` implementers, `abstract_form.directive.ts:63,68` accessor pair, `lexer.ts:116` nested `new`, the `CompilerFacade` replica cluster, DI `inject(Router)`), rustc (`rustc_ast_lowering/src/path.rs` cross-file `impl`, trait default-body dispatch), tokio and sqlx (`PgCube` enum `impl` blocks, `self.header().encoded_size()`), TypeScript, django (constructor rows), pandas (`_parser_dispatch` factory), celery (`certificate.py:100` constructor-only class, `orig = BaseTask.__call__`, `loops.synloop`), express (`lib/application.js:294` named member-assigned functions, the `require` + `mixin` pair), mocha (`@param {Suite[]} suites` + `suites[0].afterEach()`, `var s = suites[0]`), and webpack (`lib/Module.js:304`/`:317` accessor pair, `this.#tm.getTransaction()`). Add the fixtures named in §8 under `tests/fixtures/{typescript,rust,python,javascript}/code/integration/`, and pin the achieved per-corpus resolution counts in a corpus-level regression suite with one named end-to-end case per corpus.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 All fifteen sub-tasks land in §7 order, each independently verifiable before the next begins.
- [ ] #2 Every call reference emitted by the index ends as either a resolved call or a recorded `ResolutionFailure`, with the `resolved_calls + failures == references` invariant asserted in the resolver tier before the later sub-tasks land.
- [ ] #3 Every row of the §1 probe matrix that reads `receiver_type_unknown`, `member_type_unknown`, `constructor_target_not_a_class` or `polymorphic_no_implementations` today resolves, except the documented permanent limitations.
- [ ] #4 Integration tests (with the §8 fixtures) cover every evidence case in the cluster: angular qualified heritage, the CompilerFacade replicas and DI injection, rustc cross-file impl and trait default bodies, sqlx PgCube enum impls, django constructor rows, pandas `_parser_dispatch`, celery constructor-only class / `orig = BaseTask.__call__` / `loops.synloop`, express named member-assigned functions and the mixin pair, mocha element access, webpack accessor pairs and `#`-private chains.
- [ ] #5 The full pipeline is re-run over angular, rustc, tokio, sqlx, TypeScript, django, pandas, celery, express and mocha, with per-failure-reason recovery, new false negatives and call-edge deltas reported against the pre-epic baseline and against the post-step-6 and post-step-14 measurements.
- [ ] #6 The residue is re-attributed from actual failure reasons rather than the original leaf split, and the permanent limitations (WebAssembly exports object, runtime-token DI containers, celery `canvas.py:736`, Rust `Drop`) are recorded as out of scope.
- [ ] #7 A corpus-level regression suite pins the achieved per-corpus counts with one named end-to-end case per corpus, and the follow-ons (language-aware self-reference keywords, interprocedural cross-function carriers) are recorded as separate backlog items.
- [ ] #8 The insulated suites listed in §8 stay green (`method_lookup.test.ts`, `call_resolver.test.ts`, `collection_dispatch.test.ts`, `constructor*.test.ts`, `indirect_reachability.test.ts`, `scopes.test.ts`, `preprocess_references.python.test.ts`, the `classify_entry_points` suite), with fixture-level rather than assertion-level adjustments where the graph legitimately changes.

<!-- AC:END -->
