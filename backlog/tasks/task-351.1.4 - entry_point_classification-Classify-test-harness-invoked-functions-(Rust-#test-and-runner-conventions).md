---
id: TASK-351.1.4
title: "[entry_point_classification] Classify test-harness-invoked functions (Rust #[test] and runner conventions)"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - entry_point_classification
dependencies: []
parent_task_id: TASK-351.1
priority: high
ordinal: 4000
plan_dedup_key: 8dde6aa93a69add16476be6283b6daf4a775a776d80f5edb407282b63c66b5d3
plan_source_task: pt-5543b3abe5ae33e6
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

20 functions (tokio, actix-web, sqlx) bear `#[test]` / harness attributes and are invoked by the Rust test runner, never by a source-level call. Evidence index 149 explicitly notes the existing `rust-macro-invocation-call` rule's regex pattern did not match the attribute form. **Core fix:** extend the test-harness classification path in `classify_entry_points` to recognize the `#[test]`/`#[cfg(test)]`-attributed definition fingerprint that the current regex misses. This is a localized predicate-coverage gap in an existing rule family, not a new dispatch model.

## Observations

- Observed count: **20**
- Projects: `actix-web`, `sqlx`, `tokio`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `66e2912-2026-06-22T15-23-50.566Z`, `a945e09-2026-06-22T15-20-50.957Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-http/src/ws/mask.rs:51` — Function is decorated with #[test] inside a #[cfg(test)] mod, so it is invoked by the Rust test harness, not by any explicit call site in the source. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-router/src/de.rs:692` — The `#[test]` attribute at line 692 registers this function with the Rust test harness, which calls it during `cargo test` — no explicit call site exists in the codebase. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-router/src/de.rs:820` — Function is declared with `#[test]` attribute inside a `#[cfg(test)]` mod at line 587, making it callable only by the Rust test harness, not by any explicit call site in the codebase. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/guard/mod.rs:509` — The function is annotated with `#[test]` inside `#[cfg(test)] mod tests`, making it a test case invoked by the Rust test harness, not a dead function. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/request.rs:924` — The `#[test]` attribute at line 924 causes the Rust test runner to invoke this function, but this is invisible to Ariadne's pre-expansion AST analysis. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/rmap.rs:324` — Function is defined inside `#[cfg(test)] mod tests` with `#[test]` attribute, meaning it is invoked by the Rust test harness rather than by any explicit call site in the codebase. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/rmap.rs:592` — The function is decorated with `#[test]` and invoked by the Rust test harness, not by any explicit call site — no callers exist in source code. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/actix--actix-web/actix-web/src/rmap.rs:614` — The `#[test]` attribute at line 614 marks this function for invocation by the Rust test runner; no in-scope classifier rule covers attribute-macro-driven test dispatch. (project `actix-web`, run `a945e09-2026-06-22T15-20-50.957Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-cli/src/prepare.rs:376` — Function bears `#[test]` attribute inside `#[cfg(test)] mod tests`, making it a test entry point invoked by the Rust test runner, not by any textual caller in the codebase. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/listener.rs:519` — The `#[test]` attribute at line 518 marks this function for invocation by the Rust test harness, a definition-site attribute macro pattern not covered by any in-scope classifier rule. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/types/interval.rs:335` — Function is annotated with #[test] and #[cfg(feature = "chrono")], making it invoked by the Rust test harness rather than an explicit call site. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/fs/file/tests.rs:302` — The `#[test]` attribute at line 302 registers the function with the Rust test harness, which is a real caller not visible to Ariadne's call graph. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/process/mod.rs:1817` — The #[test] attribute at line 1817 marks this function for invocation by the Rust test harness; no textual caller exists in the source. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/process/unix/orphan.rs:297` — Function is annotated with #[test] and invoked automatically by the Rust test harness, with no direct call site in source. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/process/unix/pidfd_reaper.rs:271` — Function is annotated with `#[test]` at line 270 and is invoked by the Rust test harness, not by any source-level call site. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/process/unix/reap.rs:211` — The `#[test]` attribute at line 210 marks this function for invocation by the Rust test harness, but the `rust-macro-invocation-call` rule's regex pattern does not match attribute-style proc macro invocations. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/metrics/histogram.rs:589` — The `#[test]` attribute at line 589 marks this as a test function run by the Rust test harness; no direct callers exist in the codebase. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/time_alt/cancellation_queue/tests.rs:22` — The `#[test]` attribute at line 21 marks this function as a test entry point invoked by the Rust test harness, not by any explicit call site. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/runtime/time_alt/tests.rs:59` — The `#[test]` attribute at line 59 marks this as a test function invoked by the Rust test harness, not through a normal call graph. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/tokio-rs--tokio/tokio/src/task/coop/mod.rs:506` — The `#[test]` attribute at line 506 registers `budgeting` with the Rust test harness, which invokes it directly — no textual caller in the codebase exists. (project `tokio`, run `66e2912-2026-06-22T15-23-50.566Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/classify_entry_points` so the entry_point_classification pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
