---
id: TASK-376.8
title: "Attach cross-file Rust impl-block methods to their type"
status: To Do
assignee: []
created_date: "2026-07-29 09:38"
labels:
  - plan-export
  - receiver_type_inference
dependencies: []
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

§7 step 9.

## Root cause

A Rust `impl` block whose type is declared in another file contributes zero definitions: `capture_handlers/methods.rust.ts:37-56` gates method emission on a per-file `builder.find_class_by_name` / `find_enum_by_name` lookup. Reproduced on `rustc_ast_lowering/src/path.rs`: zero classes and zero methods across ~600 lines. §7 step 3 fixes the caller side (the `impl` scope names its self type), and §7 step 8 removes the emission gate and carries `impl_self_type`; the callee side — the type's member map not containing those methods — remains.

## Work plan

1. Add a project-level pass in `project/project.ts` beside the heritage builder: for each method carrying `impl_self_type`, resolve that name in the method's defining scope and merge the method into the resolved type's member map, using the per-file provenance added in §7 step 4 so the contribution is evicted with its own file.
2. Order the pass so it runs after `DefinitionRegistry.update_file` for the contributing file and before call re-resolution, and feed the affected type ids into the existing re-resolution set so callers already resolved against the incomplete member map are retried.
3. Add registry/project unit tests: a method from a cross-file `impl` appears in the target type's member index; removing the impl file removes exactly those members; re-ingesting the impl file twice does not duplicate them.
4. Add integration tests (fixtures under `tests/fixtures/rust/code/integration/`, including the multi-`impl`-block file asserted end to end) covering every evidence case for this step: two files with `struct S` in one and `impl S` in the other, with a caller in a third file invoking `s.method()`; the rustc `rustc_ast_lowering/src/path.rs` shape (a large `impl` block whose type lives in another module) yielding its methods; sqlx `PgCube`'s enum impls spread over files; and both ingestion orders (impl file before and after the type's file).

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Methods declared in a cross-file Rust `impl` block appear in the target type's member index and are callable from a third file.
- [ ] #2 The attachment is per-file provenanced: removing or re-ingesting the impl file removes/does not duplicate exactly its contributions.
- [ ] #3 Resolution is independent of the order in which the type's file and the impl file are ingested.
- [ ] #4 Integration tests with Rust fixtures cover all of this step's evidence cases: the three-file struct/impl/caller shape, the rustc `path.rs` shape, sqlx `PgCube`, and both ingestion orders.
- [ ] #5 `function_call.rust.test.ts` and `constructor.rust.test.ts` stay green.

<!-- AC:END -->
