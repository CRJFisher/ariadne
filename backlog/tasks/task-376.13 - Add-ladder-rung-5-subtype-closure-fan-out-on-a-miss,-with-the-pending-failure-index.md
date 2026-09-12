---
id: TASK-376.13
title: "Add ladder rung 5: subtype-closure fan-out on a miss, with the pending-failure index"
status: To Do
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

- [ ] #1 A miss on the member index fans out over the subtype closure via the shared `resolve_polymorphic_method`; existing hit behaviour in `method_lookup.test.ts`, including `[method_symbol, ...impls]`, is unchanged.
- [ ] #2 `pending_member_failures` exists on `ResolutionState`, is populated from `polymorphic_no_implementations` and `method_not_on_type` failures, merged and cleared per file, and evicted when a file re-resolves.
- [ ] #3 Phase 3.5 re-resolves the files holding the failing call sites, not the parent's own file.
- [ ] #4 Integration tests cover all of this step's evidence cases: all six interface/implementer/caller orders under both drivers, caller-first multi-implementer fan-out, abstract-base rung-5 resolution, the Rust trait-bound fan-out, and pending-index eviction across an incremental session.
- [ ] #5 Edge-count deltas on angular, django, rustc and pandas are measured with the taxonomy harness and reported before the change is accepted.

<!-- AC:END -->

## Notes from wave 1

The post-rung-5 row comes from `run_load_benchmark.ts --interleave` against a control checkout, which prints the per-reason delta; the baseline it is read against is `recorded_failure_taxonomy_baseline.ts`.
