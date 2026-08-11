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
2. **Enum and Protocol member collisions** — inside an Enum body the same
   assignment adds `definition.enum_member`, and inside a Protocol body
   `definition.property.interface`, so one member range carries three
   definition captures. These are the two three-way sets frozen in
   `KNOWN_RANGE_COLLISIONS`; they resolve with (1), since the member capture is
   the correct one and the field/variable pair is the surplus.
3. **Self/cls double read** — `self` mints a `reference.this` capture and the
   catch-all identifier read at one range; both become variable references.
4. **TS same-name definition duplicates** — modifier-variant patterns in
   `queries/typescript.scm` re-capture fields, parameters and methods. The
   audit now freezes the exact 35 same-(name,range) pairs as
   `known_duplicates`, so the list shrinks only deliberately and a new
   duplicate fails the build; the work here is to empty it.

## Work plan

1. Fix each duplication at the pattern (or handler) that re-captures a node
   another pattern owns, following the one-capture-per-node contract in
   `queries/CAPTURE-SCHEMA.md`.
2. After each fix, shrink the corresponding entry in `known_duplicates` or
   `KNOWN_RANGE_COLLISIONS` in `query_code_tree.test.ts` — both are compared
   exactly, so a fix that lands without the list shrinking fails.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 A Python class-body assignment yields exactly one definition capture, and the audit's Python single-definition clause runs without the field+variable exclusion.
- [ ] #2 `self.x = 1` yields one `reference.member_access` and one `reference.property` capture.
- [ ] #3 The audit's `duplicate_families` include `reference.member_access`/`reference.property` for Python and `definition.` for TypeScript, and the corpus passes.
- [ ] #4 A Protocol with N annotated attributes mints one `Protocol` type reference, not N, for bare and dotted bases alike.

<!-- AC:END -->
