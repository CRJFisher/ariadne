---
id: TASK-350.1.3
title: "[method_lookup] Capture class-body operator-to-method aliases in the member index"
status: To Do
assignee: []
created_date: "2026-06-23 20:45"
labels:
  - plan-export
  - method_lookup
dependencies: []
parent_task_id: TASK-350.1
priority: high
ordinal: 3000
plan_dedup_key: d3f1196adea3ce828dac673551a7ef665a6e6d1d58b44599cef6d30613796f5b
plan_source_task: pt-46c48757cf5ad6e9
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Members

sqlalchemy `path_registry` subscript calls dispatching to `__getitem__`, which is aliased at class-body scope to `_getitem` (`__getitem__ = _getitem`, including the `if not TYPE_CHECKING:` conditional form). The receiver type is a known RootRegistry/PathRegistry instance, but member lookup keys on the def name `_getitem` and the subscript dispatch looks for `__getitem__`, so nothing is found. Also covers the self-method / known-receiver member misses (Rust `eq_impl`, DataFrame `to_parquet`) where the member index is not populated for a method on an already-resolved type.

## Fix

When `extract_type_members` walks a class body, capture simple in-class-body assignments of one member name to another (`__getitem__ = _getitem`) as member aliases, so the member index resolves both `__getitem__` and `_getitem` to the implementing method. `resolve_method_on_type`'s member-index lookup (lines 131-140) then finds the operator method via its dunder name. Guard to literal name-to-member-name assignments at class-body scope (including the conditional form) to avoid widening into general dynamic dispatch.

## Observations

- Observed count: **6**
- Projects: `pandas`, `sqlalchemy`, `sqlx`
- Source runs: `3da582a-2026-06-22T15-54-41.005Z`, `897eeef-2026-06-22T11-45-34.787Z`, `ddf3b65-2026-06-22T10-58-10.555Z`

## Evidence

- `/Users/chuck/.ariadne/triage-entrypoints/repos/launchbadge--sqlx/sqlx-postgres/src/type_info.rs:344` — Direct `self.eq_impl(other, false)` call in the same file's impl block confirms a real caller exists that Ariadne failed to resolve. (project `sqlx`, run `3da582a-2026-06-22T15-54-41.005Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/pandas-dev--pandas/pandas/tests/io/test_parquet.py:380` — Test file calls .to_parquet() on a DataFrame instance, confirming real callers exist but resolution fails to link them to the implementation at frame.py:2827. (project `pandas`, run `897eeef-2026-06-22T11-45-34.787Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/dialects/postgresql/provision.py:158` — Real caller assigns stmt from insert() factory then calls on_conflict_do_update on it, but resolution_count=0 because the factory return type is unknown to the resolver. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/orm/path_registry.py:815` — Class-body conditional assignment `__getitem__ = _getitem` makes `_getitem` the runtime `__getitem__` implementation, but Ariadne does not resolve this alias so subscript callers are not linked back to `_getitem`. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/orm/strategies.py:1116` — Subscripts `_current_path` (which defaults to `PathRegistry.root`, a `RootRegistry` instance) via `[rev.parent]`, triggering `__getitem__` which is aliased to `RootRegistry._getitem`. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)
- `/Users/chuck/.ariadne/triage-entrypoints/repos/sqlalchemy--sqlalchemy/lib/sqlalchemy/sql/annotation.py:480` — Call to nested function clone(element) at line 480 is within \_deep_annotate's closure where clone is defined at line 436, but Ariadne resolves the name to the subsequent variable assignment clone = None at line 481 instead. (project `sqlalchemy`, run `ddf3b65-2026-06-22T10-58-10.555Z`)

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 Root-cause fix lands in `packages/core/src/resolve_references/call_resolution/method_lookup.ts` so the method_lookup pattern resolves without a classifier.
- [ ] #2 Add a regression test reproducing the observed evidence; confirm the fix covers it.

<!-- AC:END -->
