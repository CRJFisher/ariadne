---
id: TASK-364.7
title: "Decide and (if in scope) index property-assignment CommonJS exports"
status: To Do
assignee: []
created_date: "2026-07-12 00:00"
labels:
  - correctness
  - javascript
  - needs-decision
parent_task_id: TASK-364
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

`packages/core/src/index_single_file/query_code_tree/symbol_factories/exports.javascript.ts`
recognises whole-object CommonJS assignment (`module.exports = { ... }`) but
does **not** treat property-assignment CommonJS exports as exports:

- `exports.foo = ...`
- `module.exports.foo = ...`

The `exports.javascript.ts` sweep documented this as a deliberate current-state
gap (tests assert these forms are NOT indexed as exports). Whether it is a
product bug depends on whether Ariadne needs to trace incremental CommonJS
export patterns for call-graph / entry-point detection.

### Work

1. **Decision first.** Determine whether property-assignment CommonJS exports are
   in scope for the intention tree (call-graph / entry-point detection). If a
   real target codebase uses `exports.foo = ...` / `module.exports.foo = ...`
   for functions that should be reachable, it is in scope. Record the ruling.
2. **If in scope:** detect these forms in the JS export factory, marking the
   assigned name `is_exported: true` with the correct exported name. Add tests
   for both the property-assignment export (`is_exported: true`) and a
   non-exported local (`is_exported: false`).
3. **If out of scope:** convert the current descriptive tests into an explicit,
   commented statement of the boundary and close the task with the ruling
   recorded — do not leave it ambiguous.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] A recorded ruling on whether property-assignment CommonJS exports are in
      scope.
- [ ] If in scope: `exports.foo = fn` and `module.exports.foo = fn` produce a
      definition with `is_exported: true` and the right name; `is_exported`
      tested both true and false.
- [ ] If out of scope: the boundary is documented in the factory and its tests;
      no behaviour change.
- [ ] Full core suite green.

<!-- AC:END -->
