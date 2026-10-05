---
id: TASK-374.8
title: "Resolve an attribute write to the setter it invokes"
status: To Do
assignee: []
created_date: "2026-08-11 21:45"
labels:
  - call_resolution
dependencies: []
parent_task_id: TASK-374
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Root cause

A write to a property invokes its setter — `obj.value = 1` runs
`@value.setter def value` in Python and `set value()` in JS/TS — but no edge is
built for it, so a setter that is never called by name is unreachable by
construction.

TASK-374 made a read reach the getter: `call_resolver.ts` turns a
`property_access` whose member resolves to a `accessor_kind: "getter"` method
into a call edge. The write side has no counterpart. The write position is
captured — `@assignment.property` fires on the assignment node in
`queries/{python,javascript,typescript}.scm` — but `call_resolver.ts` skips
`assignment` references entirely.

Until TASK-374 the gap was masked: the member-read patterns also fired on
assignment targets, so a write minted a read that resolved to the *getter*.
That produced an edge that is wrong in kind (a write does not call the getter)
and hid genuinely unreachable accessors, so the write captures were deleted and
a write-position guard added. Setters are now honestly unreachable rather than
dishonestly reachable, and this task closes the gap properly.

## Work plan

1. Resolve an `assignment` reference whose target is a member against the
   receiver's type, mirroring the getter branch in `call_resolver.ts`, and keep
   only definitions with `accessor_kind: "setter"`.
2. Build the edge from the enclosing scope to the setter, so a setter invoked
   only by assignment stops being an entry point.
3. Leave a write to a plain data field minting no edge — only an accessor is a
   call.
4. Assert both directions at `Project` + `update_file` level with negative
   controls: a written-to setter is referenced; a written-to data field creates
   no edge; a setter never written to stays an entry point.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 `obj.value = 1` where `value` is a Python `@value.setter` or a JS/TS `set value()` creates an edge to the setter, and the setter is not reported as an entry point.
- [ ] #2 `obj.field = 1` where `field` is a plain data member creates no edge.
- [ ] #3 A setter that is never written to remains an entry point (negative control).
- [ ] #4 A write still mints no member read, so no write produces an edge to the paired getter.

<!-- AC:END -->
