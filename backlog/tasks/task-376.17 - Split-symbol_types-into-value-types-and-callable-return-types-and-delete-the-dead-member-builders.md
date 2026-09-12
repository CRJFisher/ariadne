---
id: TASK-376.17
title: "Split symbol_types into value types and callable return types and delete the dead member builders"
status: To Do
assignee: []
created_date: "2026-09-07 06:55"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.6
parent_task_id: TASK-376
priority: high
ordinal: 6500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 6, second half. Wave 3, alone: it reshapes `registries/type.ts`, which TASK-376.7, TASK-376.9 and TASK-376.10 all edit next. Requires TASK-376.6.

## Root cause

`TypeRegistry.symbol_types` (`resolve_references/registries/type.ts:52`) conflates a variable's value type with a callable's declared return type: `type_preprocessing/bindings.ts:38-47` keys a function's own location to its `return_type`, and `:50-59` does the same for a class method, in the one map a variable's declared type also lands in. That conflation is what makes `e.connect().exec()` resolve today, so it cannot be removed without re-aiming every read in the same change. Three builders construct a type's member map: `DefinitionRegistry.member_index` (`registries/definition.ts:229-279`, the live one), `extract_type_members` (`type_preprocessing/member.ts:65-148`, whose `methods` / `properties` maps are dead — STEP 2 at `type.ts:225-232` copies the map from `DefinitionRegistry` instead and STEP 3 reads only `.extends`), and `TypeRegistry.get_type_members` (`:267-314`, whose only caller is `Project.get_type_info` at `project/project.ts:707-714`, whose only callers are tests). `TypeMemberInfo` (`packages/types/src/type_member_info.ts:9-18`) exists only to carry that dead shape.

## Work plan

1. Split the store and land every read site in the same change: `symbol_types` becomes value types only; new `callable_return_types: Map<SymbolId, SymbolId>` holds function/method/constructor returns. Split `type_preprocessing/bindings.ts` into `value_bindings` (variable / parameter / property `type`) and `return_bindings` (`return_type`), and add class-property and Rust struct-field annotations as value bindings. Extend `remove_file` eviction (`type.ts:399-414`) to the new map, beside `symbol_type_arguments` from TASK-376.6.
2. Have `walk_property_chain` (`call_resolution/receiver_resolution.ts:440-530`) read `callable_return_types` for a `method` member and `symbol_types` otherwise — the method-return hop (`self.header().encoded_size()`) recorded rather than re-resolved.
3. Widen STEP 2 (`:225-232`) to read the `SemanticIndex`'s `classes` / `interfaces` / `enums` directly for `{ symbol_id, extends }`, and delete `extract_type_members` (`member.ts:65-148`), `TypeRegistry.get_type_members` (`:267-314`), the `definitions` field held only for it (`:60`), `Project.get_type_info` (`project.ts:707-714`) and `TypeMemberInfo` outright if its `extends` field has no reader left. Update `type_preprocessing/index.ts:9`. STEP 3 (`:234-260`) stays until TASK-376.7 deletes it.
4. Move `member.test.ts`'s `extract_type_members` cases: each is checked for an assertion that belongs on `DefinitionRegistry.member_index` and moved there. Move the `get_type_info` assertions across the `project.*.integration.test.ts` and `receiver_resolution.*.test.ts` families onto `definitions.get_member_index()` / `types.get_type_member()` with unchanged values.
5. Measure the call-edge deltas on angular, django, rustc and pandas with TASK-376.16's failure-taxonomy harness — control arm the tree before TASK-376.6, candidate arm this tree, same session — and record the row: the annotation resolver hands `method_lookup` far more receivers, and the row is the baseline TASK-376.13 measures rung 5 against.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `symbol_types` holds value types only, `callable_return_types` exists, every read site is re-aimed in the same change, and eviction covers the new map.
- [ ] #2 `bindings.ts` returns value and return bindings separately, and class-property and Rust struct-field annotations are value bindings.
- [ ] #3 `extract_type_members`, `TypeRegistry.get_type_members`, `Project.get_type_info` and the dead `TypeMemberInfo` shape are deleted, with their test assertions moved onto `get_member_index()` / `get_type_member()` with unchanged values.
- [ ] #4 Chained-receiver resolutions that depended on the conflation (`e.connect().exec()`) stay green.
- [ ] #5 The per-reason failure taxonomy and resolved-edge counts on angular, django, rustc and pandas are recorded against the pre-TASK-376.6 control arm in the same session.

<!-- AC:END -->

## Notes from wave 1

Per-reason rows come from `run_load_benchmark.ts --interleave` (control and candidate side by side, delta column) or `--baseline` (one arm); the predicate for a corpus with a triage config is `repository-root-excluding:<its exclude list>`. The tree these rows compare against is `recorded_failure_taxonomy_baseline.ts`.
