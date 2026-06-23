---
id: TASK-347.1.3
title: "[scope_construction] Interim classifier mitigation: suppress unresolved statically-known member/constructor self-calls"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - scope_construction
dependencies: []
parent_task_id: TASK-347.1
priority: medium
ordinal: 3000
plan_dedup_key: c371ad55ce9eeda75ba717d3ad33b4d90b22afdd3e6812ef0c9bebfb12e86496
plan_source_task: pt-d39d349104a84ff0
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Interim mitigation

While the two core scope-tree fixes are built, propose a triage classifier that recognizes the false-positive shape — a member (method or `__init__`) reported as having zero resolved callers when a statically-known intra-file/intra-class call site provably exists — and routes triage around it. This is the lower-priority interim deliverable; the scope-tree fixes above are the durable ones. Do not author the classifier predicate here; this node only proposes the work.

## Evidence

Grounded in a representative spread across the two patterns and the affected languages so the classifier predicate can be validated against real shapes: Rust cross-impl (6,18), Rust intra-impl self-call (11), Rust classmethod-style entry candidate (23), Python direct constructor (37,54), and explicit mixin construction (60).

## Observations

- Observed count: **7**
- Projects: `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, `celery`, `sqlalchemy`, `sqlx`, `tokio`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `66e2912-2026-06-22T15-23-50.566Z`, `942ac9c-2026-06-22T19-29-32.970Z`, `aef7f13-2026-06-22T10-38-14.644Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/celery--celery/t/unit/backends/test_s3.py:28` — Direct constructor call `S3Backend(app=self.app)` instantiates the class and thus invokes `S3Backend.__init__`, but Ariadne produced no resolved references to this `__init__` definition. (project `celery`, run `aef7f13-2026-06-22T10-38-14.644Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/message/response.rs:88` — The call `self.fields()` at line 88 in `get_raw` is a real caller of the private `fields` method at line 97, both on the same `Notice` struct but in different `impl Notice` blocks. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_ast_lowering/src/lib.rs:2599` — Entry point candidate: lower_const_item_rhs at line 2599 in lib.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/rust-lang--rust/compiler/rustc_parse/src/parser/mod.rs:1295` — Entry point candidate: parse_const_block at line 1295 in mod.rs (project `-Users-chuck-.ariadne-triage-entrypoints-repos-rust-lang--rust`, run `942ac9c-2026-06-22T19-29-32.970Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/examples/adjacency_list/adjacency_list.py:60` — Direct constructor call `Session(engine)` is a real caller of Session.**init** at line 1518 that Ariadne failed to link. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/schema.py:4774` — Direct explicit mixin **init** call via ColumnCollectionMixin.**init**(self, ...) which Ariadne fails to resolve as a call to the mixin's constructor. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/io/scheduled_io.rs:383` — Direct self.readiness_fut() call within the same impl ScheduledIo block confirms a real caller that Ariadne detected but could not resolve to the definition 7 lines below. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/index_single_file/scopes` so the scope_construction pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.
- [ ] #3 (Lower priority) Author the interim classifier so triage routes around the false positive until the core fix lands.

<!-- AC:END -->
