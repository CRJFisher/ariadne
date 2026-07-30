---
id: TASK-376.13
title: "Add ladder rung 5: subtype-closure fan-out on a miss, with the pending-failure index"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - method_lookup
dependencies: []
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

§7 step 14. Requires §7 steps 6 and 8.

## Root cause

`method_lookup.ts` probes the member index (`:132-138`) and, on a miss, goes straight to `method_not_on_type` — an abstract-class or base-class receiver whose method is declared only on subtypes never fans out. And resolution is ingestion-order dependent: `resolve_cross_file_type_inheritance` returns the _interface's_ file (`registries/definition.ts:482`), which holds none of the failing call sites, so a caller resolved before the implementer file was ingested is never retried. Today only implementer-before-caller passes.

## Work plan

1. Insert a subtype-closure branch between the probe (`method_lookup.ts:132-138`) and the `ok([method_symbol])` tail, reusing `get_transitive_subtypes` (`:256-279`, now iterating the edge map's keys) and the member index. Make `resolve_polymorphic_method` (`:184-211`) the shared implementation for both the interface-receiver case and the miss fan-out. Preserve the existing hit behaviour — constructor short-circuit / interface fan-out / class fan-out (`:140-171`) — unchanged; `method_not_on_type` now means _genuinely not statically reachable_.
2. Add `pending_polymorphic_failures: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>` to `ResolutionState` (`resolve_references/resolution_state.ts`), cleared per file beside `resolved_calls_by_file` (`:177-192`) and merged where resolution results merge (`:223-240`). Evict an entry when its file re-resolves successfully, or it leaks across an incremental session.
3. In `call_resolver.ts:337-403`, when emitting a `CallReference` whose failure reason is `polymorphic_no_implementations`, also emit the `(interface_id, file)` pair into the pending index; the interface id is already carried in `partial_info.resolved_receiver_type` (`method_lookup.ts:154`).
4. In `project/project.ts` Phase 3.5 (`:279-290`), map the changed-interface ids returned by the heritage builder through `pending_polymorphic_failures` into `files_needing_call_reresolution`, instead of the interface's own file.
5. Measure edge-count deltas on angular, django, rustc and pandas before assuming the recovery is pure gain — rung 5 fans a common name (`save`, `run`, `process`) to every subtype declaring it. `method_lookup.ts:140-146`'s constructor exclusion is the precedent if a guard proves necessary.
6. Add integration tests (fixtures under `tests/fixtures/{typescript,python,rust}/code/integration/`) covering every evidence case for this step: the **order-independence matrix** — interface / implementer / caller in all six ingestion orders, every one reachable (today only implementer-before-caller passes); multi-implementer fan-out with the caller ingested first; an abstract-base receiver whose method is declared only on subtypes resolving through rung 5; a Rust trait-bound receiver `fn walk<V: Visitor>(v: &mut V) { v.visit_item(); }` fanning to every `impl Visitor for T`; and an incremental session asserting the pending index is evicted when the file re-resolves.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A miss on the member index fans out over the subtype closure via the shared `resolve_polymorphic_method`; existing hit behaviour in `method_lookup.test.ts` is unchanged.
- [ ] #2 `pending_polymorphic_failures` exists on `ResolutionState`, is populated from `polymorphic_no_implementations` failures, merged and cleared per file, and evicted when a file re-resolves.
- [ ] #3 Phase 3.5 re-resolves the files holding the failing call sites, not the interface's own file.
- [ ] #4 Integration tests cover all of this step's evidence cases: all six interface/implementer/caller ingestion orders, caller-first multi-implementer fan-out, abstract-base rung-5 resolution, the Rust trait-bound fan-out, and pending-index eviction across an incremental session.
- [ ] #5 Edge-count deltas on angular, django, rustc and pandas are measured and reported before the change is accepted.

<!-- AC:END -->
