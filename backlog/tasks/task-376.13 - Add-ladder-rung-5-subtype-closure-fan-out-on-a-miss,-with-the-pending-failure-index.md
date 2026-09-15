---
id: TASK-376.13
title: "Add ladder rung 5: subtype-closure fan-out on a miss, with the pending-failure index"
status: Done
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies:
  - TASK-376.7
  - TASK-376.16
parent_task_id: TASK-376
priority: high
ordinal: 13000
plan_dedup_keys:
  - af0eb904c4bb9a5ecbf2308fa7fb3ed852ce006f502566040c0eec30dd502cee
plan_source_tasks:
  - pt-c94a41f99b46bd21
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 14. Wave 5, beside TASK-376.11. Requires TASK-376.7 (the complete subtype graph) and TASK-376.16 (the failure vocabulary the pending index is keyed from; shares `call_resolver.ts` with it).

## Root cause

`method_lookup.ts` probes the member index (`:139-149`) and, on a miss (`:151-157`), returns `method_not_on_type` before any interface or class check — an abstract-class or base-class receiver whose method is declared only on subtypes never fans out. The fan-out exists only on a **hit** (`:159-196`): an interface receiver resolves to `[method_symbol, ...impls]` (`:176-182`, TASK-389) and carries the interface id in `partial_info.resolved_receiver_type` (`:173`) when the implementer set is empty.

Resolution is order-dependent on the **incremental** driver. The bulk driver (`Project.ingest_file` × N then `resolve_corpus`, `project/project.ts:244-253`) runs heritage over the whole corpus before any call resolves, and TASK-381.11's seven-number fingerprint is byte-identical across four ingest orders. On `update_file` (`:147-159`), a file edit that adds an implementer re-resolves the interface's own file — `resolve_cross_file_type_inheritance` returns the parent's file (`registries/definition.ts:709-712`) into `files_needing_call_reresolution` (`project.ts:418`, consumed at `:465`) — and the implementer's import-graph dependents (`files_affected_by`, `:513-549`), never the third-file callers that dispatch through the interface. A caller resolved before the implementer arrived is never retried.

## Work plan

1. Insert a subtype-closure branch between the probe miss (`:151-157`) and the `err(method_not_on_type)` return, reusing `get_transitive_subtypes` (`:282-305`, `processed` guard at `:292`; now iterating the edge map's keys) and the member index. Make `resolve_polymorphic_method` (`:210-237`) the shared implementation for both the interface-receiver case and the miss fan-out. Preserve the existing hit behaviour — constructor short-circuit (`:159-165`), `[method_symbol, ...impls]` for an interface, base + overrides for a class — unchanged; `method_not_on_type` now means _genuinely not statically reachable_.
2. Add `pending_member_failures: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>` to `ResolutionState` (`resolve_references/resolution_state.ts`), keyed by `partial_info.resolved_receiver_type` for both `polymorphic_no_implementations` and `method_not_on_type`, so TASK-376.8's attach pass retries through the same index. Clear it per file in the batch eviction `remove_files` (`:231-293`) and merge it in `apply_call_resolution` (`:316-341`). Evict an entry when its file re-resolves successfully, or it leaks across an incremental session.
3. In `call_resolver.ts`, where the failure is attached (`:342-347`) and the `CallReference` built (`build_call_reference`, `:370-448`), also emit the `(receiver_type_id, file)` pair into the pending index.
4. In `project/project.ts` Phase 3.5 (`resolve_files`, `:417-427`), map the changed-parent ids returned by the heritage builder through `pending_member_failures` into `files_needing_call_reresolution`, instead of the parent's own file.
5. Measure edge-count deltas on angular, django, rustc and pandas with the taxonomy harness against TASK-376.17's row before assuming the recovery is pure gain — rung 5 fans a common name (`save`, `run`, `process`) to every subtype declaring it. `method_lookup.ts:159-165`'s constructor exclusion is the precedent if a guard proves necessary.
6. Add integration tests (fixtures under `tests/fixtures/{typescript,python,rust}/code/integration/`) covering every evidence case for this step: the **order-independence matrix** — interface / implementer / caller in all six orders through the incremental driver (`update_file`), every one reachable, and the same six orders through the bulk driver (`ingest_file` × N then `resolve_corpus`) as the insulation; multi-implementer fan-out with the caller ingested first; an abstract-base receiver whose method is declared only on subtypes resolving through rung 5; a Rust trait-bound receiver `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` fanning to every `impl Visitor for T`; and an incremental session asserting the pending index is evicted when the file re-resolves. TASK-392's late-binding order dependence (`TypeRegistry.register_late_binding`) is a separate mechanism and stays open there.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 A miss on the member index fans out over the subtype closure via the shared `resolve_polymorphic_method`; existing hit behaviour in `method_lookup.test.ts`, including `[method_symbol, ...impls]`, is unchanged.
- [x] #2 `pending_member_failures` exists on `ResolutionState`, is populated from `polymorphic_no_implementations` and `method_not_on_type` failures, merged and cleared per file, and evicted when a file re-resolves. (As `subtype_dispatch_files`, which also holds the dispatches that resolved — see the notes.)
- [x] #3 Phase 3.5 re-resolves the files holding the failing call sites, not the parent's own file.
- [x] #4 Integration tests cover all of this step's evidence cases: all six interface/implementer/caller orders under both drivers, caller-first multi-implementer fan-out, abstract-base rung-5 resolution, the Rust trait-bound fan-out, and pending-index eviction across an incremental session. (The Rust fan-out through a `dyn Visitor` receiver; the `V: Visitor` generic bound is carried to TASK-376.15.)
- [x] #5 Edge-count deltas on angular, django, rustc and pandas are measured with the taxonomy harness and reported before the change is accepted.

<!-- AC:END -->

## Notes from wave 1

The post-rung-5 row comes from `run_load_benchmark.ts --interleave` against a control checkout, which prints the per-reason delta; the baseline it is read against is `recorded_failure_taxonomy_baseline.ts`.

## Implementation notes

- **The miss fans out.** `resolve_method_on_type` (`call_resolution/method_lookup.ts`) resolves a class or interface receiver that neither declares nor inherits the member to every transitive subtype declaring it. The interface fan-out, the class override fan-out and the miss all enumerate the closure through `resolve_polymorphic_method`; `resolve_polymorphic_class_method` is gone, its loop now `[base, ...overrides]` over the shared result. Hit behaviour and ordering are unchanged, and every existing `method_lookup.test.ts` case passes with only the new return shape.
- **Two guards on the miss.** A constructor never fans out (the `:159-165` precedent applied to the miss). A `super` receiver never fans out: `super().m()` dispatches up the chain from the parent, and fanning down reaches the caller's own override — a self-edge that hides an entry point. This guard came from the corpus: django's first candidate arm fanned `super().setUp()` (parent `SimpleTestCase`, method from `unittest.TestCase`) to 284 `setUp`s per call and `super().get_queryset()` to 33, 3,442 new edges in all; with the guard, 484. `method_call.ts` passes `ReceiverBinding` `"super"` for a bare `super` receiver and `"value"` otherwise.
- **The lookup names the closure it read.** `MethodLookup { targets, subtype_closure_of }` is what `resolve_method_on_type` and `resolve_method_call` return. `subtype_closure_of` is the receiver on an interface hit, a class hit (with or without subtypes) and a value-receiver miss on a class or interface; null on every import, namespace, collection, constructor and `super` path.
- **Deviation: the index holds every dispatch through a closure, not only failures.** `ResolutionState.subtype_dispatch_files` maps a type to the files holding a call, getter read or callable-value read whose lookup enumerated its closure. Recording failures alone loses the caller once it resolves: caller, interface, implementer A, implementer B through `update_file` leaves the caller on `[I.m, A.m]` forever. `call_resolution/subtype_dispatch.ts` gathers it during a pass; `apply_call_resolution` replaces each resolved file's entries (which also evicts files re-resolved only for their calls, since those skip `remove_files`); `remove_files` evicts per file and keeps its identity return.
- **What re-answers a caller.** Phase 3.5 unions two sets of changed types: parents from `resolve_type_heritage`, and `DefinitionRegistry.take_changed_member_types` — the types a file contributes members to differently from before its latest eviction (added, removed, or moved to a new symbol). `get_supertype_closure` widens them to every type above, and `ResolutionRegistry.get_files_dispatching_through` names the files, replacing the parent's own file. `remove_file` does the same with `take_evicted_heritage_parents`.
- **The member half was found in review.** An edit inside an implementer's class body that moves `area()` down a line leaves `Square implements Shape` unchanged, so no parent changes — and before this step the interface's third-file callers kept the old `Square.area` symbol while the live one became an entry point. Heritage-only triggering reproduced it on the base tree. `MemberIndex` keeps each file's contributions from its first eviction since it was last asked, so a file registered twice in one update (Phase 2, then Phase 2.5) compares against what its callers resolved against.
- **Incremental cost, measured on angular (bulk load, then `update_file`).** The index holds 3,631 types and 8,302 (type, file) pairs. An edit inside a class body in `packages/core/test/acceptance/injector_profiler_spec.ts` (a class extending `Injector`, imported by nothing) re-resolves 94 files in 593 ms against 2 files in 298 ms on the control tree. The same edit in hub files (`di/injector.ts`, `linker/view_ref.ts`, `testing/src/test_bed.ts`) re-resolves the same 289–932 files as control in the same time: their importers already include every dispatcher.
- **Test changes the behaviour requires.** `project.integration.test.ts` › TASK-389 renamed the interface member to break the destructured hop; with the miss fanning out, `FileStorage.sweep` is still reached, so the test now renames the interface. The fixture corpus tallies in `call_resolver.test.ts` move by exactly the new `subtype_dispatch` fixtures.
- **Out of scope, recorded.**
  - A class-hit dispatch through `super` still fans out to the parent's overrides, the calling class's own included (`super().save()` where the parent declares `save`). That is existing hit behaviour, which AC #1 keeps.
  - A member supplied at runtime is invisible to the closure: django's `Manager = BaseManager.from_queryset(QuerySet)` declares no `create`, so 65 `objects.create(...)` calls in django's tests now reach the one test manager subclass that declares `create`.
  - The Rust `fn walk<V: Visitor>` receiver ends `receiver_type_unknown` before method lookup; binding `V` to its bound is TASK-376.15's step 2, and the evidence case is carried there.

### Measurement

Rows come from `run_load_benchmark.ts --baseline` over each corpus with the recorded commit and predicate. The control arm is `4d1095e5` (the TASK-376.11 merge, run from a checkout of its identical tree `03b78fce` with `dist` rebuilt so pass A indexes with the same code); the candidate arm is this step's tree. Same box, same session. CPU seconds are single runs: two runs of the same candidate code differed by up to 30 s on django and pandas, so no CPU change is distinguishable from noise.

| Corpus (commit, predicate) | Arm | Call refs | Resolved | `method_not_on_type` | `polymorphic_no_implementations` | Call edges | Raw entry points | CPU s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| angular/angular `5ad82313`, `repository-root` | control | 378709 | 159379 | 5519 | 1414 | 157519 | 3221 | 108.2 |
| | candidate | 378743 | 159441 | 5491 | 1414 | 157621 | 3172 | 112.0 |
| | delta | +34 | **+62** | −28 | 0 | **+102** | **−49** | +3.8 |
| rust-lang/rust `e7b59555`, `repository-root-excluding:tests,src/tools,library/stdarch,library/compiler-builtins,library/coretests` | control | 328739 | 112145 | 19703 | 236 | 94668 | 19992 | 101.2 |
| | candidate | 328739 | 112264 | 19584 | 236 | 94840 | 19980 | 97.9 |
| | delta | 0 | **+119** | −119 | 0 | **+172** | **−12** | −3.3 |
| django/django `957d0cee`, `repository-root-excluding:js_tests,scripts,docs` | control | 202890 | 85455 | 62837 | 0 | 73651 | 2325 | 262.2 |
| | candidate | 202972 | 85707 | 62667 | 0 | 74135 | 2261 | 247.1 |
| | delta | +82 | **+252** | −170 | 0 | **+484** | **−64** | −15.1 |
| pandas-dev/pandas `7986b425`, `repository-root` | control | 244256 | 117674 | 39034 | 1 | 84777 | 2103 | 206.1 |
| | candidate | 244360 | 117902 | 38910 | 1 | 85108 | 2078 | 230.4 |
| | delta | +104 | **+228** | −124 | 0 | **+331** | **−25** | +24.3 |

Every other failure reason is unchanged on every corpus; angular's indirect-reachability keys move 12,319 → 12,322.

- **Recovery is the misses.** Every newly resolved call ended `method_not_on_type` on the control arm; `polymorphic_no_implementations` does not move, because the bulk driver already resolved the interface cases rung 5's index exists for on the incremental driver. The call-reference rise is getter reads (`property_access`) that now reach a subtype's getter: 82 on django, where all 170 recovered call sites were diffed site by site against the control arm and none lost a target.
- **Fan-out after the `super` guard.** On django 101 of the 170 recovered sites have one target and three have more than 11 (13, 18 and 47). The widest are the template-method shapes the rung exists for: `SQLiteNumericMixin.as_sql` (47), `MiddlewareMixin` reaching `process_response` (18) and `process_request` (13), `ListMixin._get_single_external`, `Storage._save`.
- **Against TASK-376.17's row.** Of the control arm's 5,519 (angular) and 19,703 (rustc) `method_not_on_type` calls, 28 and 119 find a subtype declaring the member; the rest name a member no subtype in the project declares.

