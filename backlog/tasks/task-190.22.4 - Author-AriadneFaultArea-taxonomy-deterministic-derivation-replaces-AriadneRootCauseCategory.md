---
id: TASK-190.22.4
title: >-
  Author AriadneFaultArea taxonomy + deterministic derivation (replaces
  AriadneRootCauseCategory)
status: To Do
assignee: []
created_date: "2026-06-01 14:18"
updated_date: "2026-06-01 14:48"
labels:
  - self-repair
  - schema
  - fault-taxonomy
dependencies:
  - TASK-190.22.1
references:
  - /Users/chuck/.claude/plans/i-should-have-mentioned-sorted-quiche.md
  - packages/types/src/call_chains.ts
  - packages/types/src/entry_point.ts
  - packages/types/src/ariadne_root_cause.ts
parent_task_id: TASK-190.22
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Why

The `plan` engine (TASK-190.22.5) groups false-positives by "which part of Ariadne is at fault" and routes each fix to the right code area. This requires a standardised fault-area taxonomy. The key design decision: the fault area is a **DERIVED VIEW** over the deterministic signal Ariadne core already emits — NOT a new independently-stored enum. Phase 1 (190.22.1) stores `diagnosis` + `resolution_failure {stage,reason}` on each verdict; the area is **computed-on-read** from those by a pure total function. This is grounded entirely in existing code, adds no speculative stored field, and is refactor-safe (a core IA refactor edits only the folder-map, never stored data). It strictly refines and REPLACES the coarse 6-value `AriadneRootCauseCategory` (`packages/types/src/ariadne_root_cause.ts`) — a no-shim replacement, not a parallel taxonomy.

## The taxonomy — `AriadneFaultArea` (9 values + `other`), each anchored 1:1 to a core folder

- `syntactic_extraction` → `core/src/index_single_file/query_code_tree` (+ references/definitions extractors) — query/capture never produced the call site.
- `scope_construction` → `core/src/index_single_file/scopes` — malformed/missing scope tree (`no_enclosing_class_scope`, `definition_has_no_body_scope`, `no_parent_class`, `class_definition_not_found`).
- `name_resolution` → `core/src/resolve_references/name_resolution.ts` — in-scope name lookup failed (`name_not_in_scope`).
- `import_resolution` → `core/src/resolve_references/import_resolution` — cross-file import/re-export linking (`import_unresolved`, `reexport_chain_unresolved`).
- `receiver_type_inference` → `core/src/resolve_references/call_resolution/receiver_resolution.ts` + `type_preprocessing` — receiver/member type lost (`receiver_type_unknown`, `member_type_unknown`, `method_not_on_type`@receiver_resolution).
- `method_lookup` → `core/src/resolve_references/call_resolution/method_lookup.ts` (+ `constructor.ts`) — type known, member absent (`method_not_on_type`@method_lookup, `constructor_target_not_a_class`).
- `polymorphic_dispatch` → `method_lookup.ts` (`resolve_polymorphic_method`) — interface receiver, no implementations (`polymorphic_no_implementations`).
- `collection_dispatch` → `core/src/resolve_references/call_resolution/collection_dispatch.ts` — value-in-collection / dynamic key (`collection_dispatch_miss`, `dynamic_dispatch`).
- `coverage_config` → `core/src/project` — call sites live in excluded files (unindexed test dirs).
- `entry_point_classification` → `core/src/classify_entry_points` (+ `trace_call_graph`) — resolution succeeded but the function is still flagged (`callers-in-registry-wrong-target`, or genuine EP miss).
- `other` — residual; `needs_judgement`.

## Derivation (TOTAL, deterministic) — key on `(stage, reason)`, NOT reason alone

CRITICAL correctness point (verified against emit sites): the same `reason` is emitted from multiple stages with different meaning — e.g. `method_not_on_type` → `receiver_type_inference` when stage=`receiver_resolution` but → `method_lookup` when stage=`method_lookup`; `name_not_in_scope` shares the `name_resolution` stage with the scope-construction reasons. So the primary table is `(stage, reason) → area` covering all 14 reasons. Fallback when `resolution_failure` is absent: `diagnosis → area` (`no-textual-callers`/`callers-in-registry-wrong-target` → `entry_point_classification`; `callers-not-in-registry` → `coverage_config` if callers only in unindexed tests, else `syntactic_extraction`). Precedence: `resolution_failure` (most specific) first, else `diagnosis`. Full per-cell table with emit-site line numbers is in the design spec (see references).

## Schema + placement

- New file `packages/types/src/ariadne_fault_area.ts` (next to its deterministic peers `call_chains.ts`/`entry_point.ts`). String-literal union (match existing convention), NOT branded enum. `area` is COMPUTED, never stored.
- `AriadneFaultLocation { area, resolution_stage?, resolution_reason?, language?, needs_judgement }`.
- `ARIADNE_FAULT_AREA_FOLDER: Record<AriadneFaultArea, string>` — SEPARATE refactor-safe lookup (repo-relative POSIX paths).
- `derive_fault_area(input): AriadneFaultLocation` — pure total function encoding the (stage,reason) table + diagnosis fallback; exhaustively type-checked against the source enums.
- Barrel export from `packages/types/src/index.ts`.

## Callers to update (no shims)

- `packages/types/src/backlog_task.ts:23` — `cluster_hint: AriadneRootCauseCategory` → `AriadneFaultArea`.
- Delete `packages/types/src/ariadne_root_cause.ts` once consumers move (it's strictly refined by the new taxonomy).
- `packages/core/src/classify_entry_points/extract_entry_point_diagnostics.ts` — populate the two disambiguators (`has_uncaptured_indexed_grep_hit` from `GrepHit.captures`; `callers_only_in_unindexed_tests` from `grep_call_sites_unindexed_tests`) so the planner derives without re-grepping.
- Consumed by the `plan` engine (TASK-190.22.5): it derives the area per verdict at grouping time and routes groups to `ARIADNE_FAULT_AREA_FOLDER[area]`.

## Residual-judgement cases (deterministic default + `needs_judgement: true`; the plan strategist decides)

1. `callers-not-in-registry` with an indexed grep hit that HAS captures (ref produced but no CallReference reached registry) — default `syntactic_extraction`.
2. `callers-in-registry-unresolved` with NO `resolution_failure` (resolver returned empty without emitting a diagnostic — itself an Ariadne defect) — default `other`; file a task to add the missing emit.
3. `no-textual-callers` — genuine entry point vs true-positive classification miss — default `entry_point_classification`.
4. `collection_dispatch_miss` whose root cause is an upstream unresolved import — may re-route to `import_resolution`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `packages/types/src/ariadne_fault_area.ts` defines the 9-value (+`other`) `AriadneFaultArea` union, `AriadneFaultLocation`, and the `ARIADNE_FAULT_AREA_FOLDER` map (area→core folder, separate from the value list); barrel-exported
- [ ] #2 `derive_fault_area` is a pure TOTAL function keyed on `(stage, reason)` (not reason alone) with a `diagnosis` fallback; exhaustively covers all 14 `ResolutionFailureReason` values and all 4 `diagnosis` values; unit-tested per cell with the documented expected area
- [ ] #3 `area` is computed-on-read, never stored; the only stored fault signal remains the deterministic `diagnosis` + `resolution_failure` (from 190.22.1)
- [ ] #4 `AriadneRootCauseCategory` is replaced: `backlog_task.ts` `cluster_hint` uses `AriadneFaultArea`, `ariadne_root_cause.ts` is deleted, all consumers updated (no shim/alias)
- [ ] #5 `extract_entry_point_diagnostics.ts` populates the two disambiguator signals (`has_uncaptured_indexed_grep_hit`, `callers_only_in_unindexed_tests`) the fallback derivation needs
- [ ] #6 The 4 residual-judgement cases return their documented default with `needs_judgement: true`; a test asserts the flag is set for each
- [ ] #7 `pnpm typecheck && pnpm test` green; the derivation table type-checks exhaustively against the source enums (a new reason/stage forces a compile error until mapped)
<!-- AC:END -->
