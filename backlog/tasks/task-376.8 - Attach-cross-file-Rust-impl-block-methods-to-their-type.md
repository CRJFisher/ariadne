---
id: TASK-376.8
title: "Attach cross-file Rust impl-block methods to their type"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies:
  - TASK-376.4
  - TASK-376.7
  - TASK-376.13
parent_task_id: TASK-376
priority: high
ordinal: 8000
plan_dedup_keys:
  - 45a25d46451591dad55c956d7566d342a99fed1087ca45fc6b32ff7d92b1f3d3
plan_source_tasks:
  - pt-113b6f4ab90cbfd7
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

§7 step 9. Wave 6, beside TASK-376.14 and TASK-376.15; shares `project/project.ts` Phase 3.5 with TASK-376.14. Requires TASK-376.4 (the provenanced `attach_members` write path), TASK-376.7 (methods carrying `impl_self_type` are emitted at all) and TASK-376.13 (the pending-failure index that retries the callers).

## Root cause

A Rust `impl` block whose type is declared in another file contributes zero definitions until TASK-376.7 removes the emission gate at `capture_handlers/methods.rust.ts:47-55`. Reproduced on rustc: `struct LoweringContext` is declared in `compiler/rustc_ast_lowering/src/lib.rs:146` and `impl<'hir> LoweringContext<'_, 'hir>` in `path.rs:23` (zero classes, zero methods across ~600 lines). TASK-376.3 fixes the caller side (the `impl` scope names its self type) and TASK-376.7 emits the methods with `impl_self_type`; the callee side — the type's member map not containing those methods — remains, because `DefinitionRegistry.update_file` attaches members only from a type definition in the same file. sqlx's `PgCube` (`sqlx-postgres/src/types/cube.rs`, every `impl` in the declaring file) is not this shape and is TASK-376.5's evidence.

## Work plan

1. Add a project-level pass in `project/project.ts` inside `resolve_files` (`:391-475`) beside the heritage builder at Phase 3.5 (`:417-427`): for each method carrying `impl_self_type`, resolve that name in the method's defining scope and merge the method into the resolved type's member map through `attach_members` (TASK-376.4), so the contribution is evicted with its own file.
2. Order the pass after `DefinitionRegistry.update_file` for the contributing file and before call re-resolution, and feed the affected type ids through TASK-376.13's pending-failure index into `files_needing_call_reresolution` (`:418`, consumed at `:465`), so callers already resolved against the incomplete member map are retried. The pass runs under both drivers: the incremental `update_file` (`:147-159`) and the bulk `ingest_file` × N then `resolve_corpus` (`:244-253`).
3. Add registry/project unit tests: a method from a cross-file `impl` appears in the target type's member index; removing the impl file removes exactly those members; re-ingesting the impl file twice does not duplicate them.
4. Add integration tests (fixtures under `tests/fixtures/rust/code/integration/`, including the multi-`impl`-block file asserted end to end) covering every evidence case for this step: two files with `struct S` in one and `impl S` with a `self.method()` call in the other (the end-to-end half of TASK-376.5's unit case); the same pair with a caller in a third file invoking `s.method()`; the rustc `rustc_ast_lowering` shape (a large `impl` block whose type lives in another module) yielding its methods; and both ingestion orders (impl file before and after the type's file) under both drivers.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Methods declared in a cross-file Rust `impl` block appear in the target type's member index and are callable from the `impl` block itself and from a third file.
- [ ] #2 The attachment is per-file provenanced: removing or re-ingesting the impl file removes/does not duplicate exactly its contributions.
- [ ] #3 Resolution is independent of the order in which the type's file and the impl file are ingested, under the incremental driver and the bulk driver.
- [ ] #4 Integration tests with Rust fixtures cover all of this step's evidence cases: the two-file `self.method()` shape, the three-file struct/impl/caller shape, the rustc `LoweringContext` shape, and both ingestion orders.
- [ ] #5 `function_call.rust.test.ts`, `constructor.rust.test.ts` and `path_resolution.rust.test.ts` stay green.

<!-- AC:END -->

## Notes from wave 1

`DefinitionRegistry.attach_members(type_id, file, members)` takes an iterable of `[name, symbol_id]` pairs and applies them in order under one rule (`member_takes_slot`: a property never displaces a callable, a setter or deleter never displaces anything, a callable displaces whatever else holds the name). Every member attached must already be registered in `by_symbol` under the file it is defined in — an `impl` block's methods belong to the impl's file — because `verify_reverse_indices` rebuilds `members_by_file` from each held member's defining file and the test suite runs with that check armed. `remove_file` takes back exactly the names the file holds, so the attach pass needs no eviction of its own.
