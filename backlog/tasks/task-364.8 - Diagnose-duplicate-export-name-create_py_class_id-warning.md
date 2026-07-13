---
id: TASK-364.8
title: "Diagnose the Duplicate export name create_py_class_id warning"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - investigation
  - self-indexing
parent_task_id: TASK-364
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

During the `exports.javascript.ts` sweep, Ariadne's own indexer (run over its own
source) emitted a `Duplicate export name create_py_class_id` warning against
`packages/core/src/index_single_file/query_code_tree/symbol_factories/index.ts`.

The barrel aliases a re-export at `index.ts:83`
(`create_class_id as create_py_class_id`). The warning suggests the name
`create_py_class_id` is produced by the indexer more than once for that barrel —
either a genuine duplicate re-export (two sources aliased to the same public
name) or a false positive in Ariadne's own export-collision detection.

This is a self-indexing signal (Ariadne analysing Ariadne), so it doubles as a
correctness check on the export-collision logic.

### Work

1. Reproduce the warning by indexing `symbol_factories/index.ts` (or the whole
   `packages/core` source) with Ariadne.
2. Determine the root cause: is there a real duplicate public export named
   `create_py_class_id` (fix the barrel — pick one source, no aliased
   collision), or is the collision detector wrongly counting an aliased
   re-export as a duplicate (fix the detector)?
3. Fix the root cause and confirm the warning no longer fires.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] Root cause identified and recorded (real duplicate vs. detector false
      positive).
- [ ] Indexing `packages/core` no longer emits
      `Duplicate export name create_py_class_id`.
- [ ] If the detector was at fault, a regression test covers the aliased-
      re-export case; full core suite green.

<!-- AC:END -->
