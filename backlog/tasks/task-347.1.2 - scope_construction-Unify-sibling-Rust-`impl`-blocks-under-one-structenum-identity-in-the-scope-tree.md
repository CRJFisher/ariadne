---
id: TASK-347.1.2
title: "[scope_construction] Unify sibling Rust `impl` blocks under one struct/enum identity in the scope tree"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-347.1
priority: high
ordinal: 2000
plan_dedup_key: 6273ce3fa544c754b31647190ecf56dc1b8775b76a5c387fc1a853c8e58a4bb3
plan_source_task: pt-e38a1e8b93d5819e
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Fix

In `scopes/`, the Rust path must record, for each `impl Foo` block's class-scope, the _target type identity_ `Foo` (already extracted as the `type` field in `RustScopeBoundaryExtractor.extract_impl_boundaries`, currently used only for `symbol_location`). Methods declared across multiple `impl Foo` (and `impl Trait for Foo`) blocks must be reachable as members of a single `Foo` identity rather than siblings of unrelated, position-keyed class-scopes.

## Evidence

The sharpest cases are cross-impl-block calls: `self.fields()` resolving across two `impl Notice` blocks (6), `self.try_visit_primitive` called from a trait-impl block but defined in a plain `impl ValidityVisitor` (18), and `self.simplify_rvalue` in a `MutVisitor impl for VnState` reaching a plain-impl definition (15). The intra-impl self-calls (3,4,5,7,10,11,12,14,16,17) and the entry-point-candidate methods on large Rust impls (19,20,21,22,23) all resolve once a method scope carries its struct identity. `_simplify_floor_div` lives in this group as a Rust-shaped `cls(...)`-style intra-impl call is not applicable — that one is constructor (handled below).

## Observations

- Observed count: **18**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `sqlx`, `tokio`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `66e2912-2026-06-22T15-23-50.566Z`, `942ac9c-2026-06-22T19-29-32.970Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/examples/postgres/axum-social-with-tests/src/http/error.rs:55` — The call `self.status_code()` at line 55 in `into_response` directly invokes the method defined at line 66 in the same file's `impl Error` block, but Ariadne's resolution_count is 0. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/arguments.rs:85` — Direct field-access method call `self.buffer.snapshot()` in `PgArguments::add` is the sole caller; Ariadne detected it (resolution_count=0, unresolved) but failed to link it to the definition at line 217. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/message/response.rs:88` — The call `self.fields()` at line 88 in `get_raw` is a real caller of the private `fields` method at line 97, both on the same `Notice` struct but in different `impl Notice` blocks. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/type_info.rs:1030` — Direct method call on `self` of type `PgType` within the same file as the definition, but Ariadne failed to resolve it (resolution_count=0). (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/types/cube.rs:85` — self.header() at line 85 is a direct concrete method call on PgCube within the same file, with resolution_count=0 showing Ariadne failed to link it to the definition at line 118 (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_ast_lowering/src/lib.rs:2120` — Entry point candidate: lower_lifetime_hidden_in_path at line 2120 in lib.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_ast_lowering/src/lib.rs:2599` — Entry point candidate: lower_const_item_rhs at line 2599 in lib.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_ast_lowering/src/path.rs:482` — Direct self-method call on a concrete LoweringContext receiver that Ariadne indexed but failed to resolve to the definition in lib.rs. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_ast_pretty/src/pprust/state.rs:2241` — Entry point candidate: print_fn_ret_ty at line 2241 in state.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_const_eval/src/interpret/validity.rs:1379` — Direct `self.try_visit_primitive(val)` call within `visit_value` (trait impl at line 1264) to a method defined in the plain `impl ValidityVisitor` block at line 875; grep confirms the call exists but Ariadne reports resolution_count=0. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_hir_pretty/src/lib.rs:180` — Direct self.print_trait_item() call on State within print_node (same file, same impl) shows resolution_count=0, indicating the resolver failed to link this intra-impl method call. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_hir_pretty/src/lib.rs:181` — Direct call `self.print_impl_item(a)` on a concrete `State` receiver in `print_node`, same file as the definition at line 976, yet Ariadne shows resolution_count=0. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_mir_transform/src/gvn.rs:2096` — Direct self.simplify_rvalue() call within MutVisitor impl for VnState at line 2096 is a real caller of the definition at line 1060, but Ariadne shows resolution_count=0. (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_parse/src/parser/mod.rs:1295` — Entry point candidate: parse_const_block at line 1295 in mod.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_trait_selection/src/traits/select/mod.rs:2313` — Entry point candidate: constituent_types_for_auto_trait at line 2313 in mod.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/io/scheduled_io.rs:383` — Direct self.readiness_fut() call within the same impl ScheduledIo block confirms a real caller that Ariadne detected but could not resolve to the definition 7 lines below. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/worker.rs:1091` — Direct method call on a struct field with a concrete generic type; grep confirms the call site exists and the field type is declared at line 127. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/scheduler/multi_thread/worker.rs:1189` — Real caller invokes has_tasks() on self.run_queue which is of type Local<T> defined in queue.rs, but Ariadne's resolution_count=0 indicates it failed to link the field's type to the method definition. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/index_single_file/scopes` so the scope_construction pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
