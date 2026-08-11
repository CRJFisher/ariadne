---
id: TASK-374.5
title: "Deduplicate the residual cross-name and TS definition captures"
status: To Do
assignee: []
created_date: "2026-08-11 09:20"
labels:
  - syntactic_extraction
dependencies: []
parent_task_id: TASK-374
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

The fixture-corpus audit in
`packages/core/src/index_single_file/query_code_tree/query_code_tree.test.ts`
scopes its duplicate-capture families to what the task-374 family drove to
zero. The residual duplicates it documents and excludes are owned here:

1. **Python cross-name field/variable collision** — a class-body assignment
   (`count = 0` in a class) mints `definition.field` and `definition.variable`
   at one byte range: the class-attribute pattern and the general assignment
   pattern in `queries/python.scm` both fire. A class attribute is not a scope
   variable; the general pattern (or its handler) should exclude direct
   class-body assignments.
2. **Python assignment-side member captures** — the assignment-left attribute
   pattern re-captures `@reference.member_access` and `@reference.property` on
   the same node the general attribute pattern already owns, so `self.x = 1`
   duplicates both.
3. **Self/cls double read** — `self` mints a `reference.this` capture and the
   catch-all identifier read at one range; both become variable references.
4. **TS same-name definition duplicates** — modifier-variant patterns in
   `queries/typescript.scm` re-capture fields, parameters and methods
   (35 same-(name,range) pairs over the corpus), which is why the audit's
   `definition.` family is python/javascript-only.

## Work plan

1. Fix each duplication at the pattern (or handler) that re-captures a node
   another pattern owns, following the one-capture-per-node contract in
   `queries/CAPTURE-SCHEMA.md`.
2. After each fix, widen the audit's `duplicate_families` (and the Python
   `single_definition_per_range` exclusion) in `query_code_tree.test.ts` so
   the invariant locks.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A Python class-body assignment yields exactly one definition capture, and the audit's Python single-definition clause runs without the field+variable exclusion.
- [ ] #2 `self.x = 1` yields one `reference.member_access` and one `reference.property` capture.
- [ ] #3 The audit's `duplicate_families` include `reference.member_access`/`reference.property` for Python and `definition.` for TypeScript, and the corpus passes.

<!-- AC:END -->
