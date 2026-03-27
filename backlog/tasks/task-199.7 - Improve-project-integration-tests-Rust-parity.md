---
id: TASK-199.7
title: Improve project integration tests (Rust parity)
status: To Do
assignee: []
created_date: "2026-03-27 23:14"
updated_date: "2026-03-27 23:18"
labels:
  - testing
  - project
dependencies: []
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

## Findings

Rust has the weakest project-level integration test coverage compared to the other 3 languages.

### Cross-cutting gaps (all languages)

- `Project.save()` and `restore_file()` — zero test coverage
- `initialize()` with `excluded_folders` — untested
- TSX/JSX files — `detect_language()` supports them but no test uses them

### TypeScript gaps

- Re-exports (`export { X } from "./y"`), aliased named imports, default exports/imports
- Enums, type aliases, generic classes/functions — fixture files exist but no integration tests
- Many orphaned fixture files in `tests/fixtures/typescript/code/`

### JavaScript gaps

- Namespace imports (`import * as X`), polymorphic child dispatch (documented as not yet implemented)
- Orphaned fixture files: `basic_class.js`, `dynamic_access.js`, `object_literals.js`, etc.

### Python gaps

- Dataclasses, advanced OOP, classmethods/staticmethods (fixture files exist but unused)
- `__all__` export control

### Rust gaps (most significant)

- **No incremental update tests** (TS/JS/Python all have them)
- **No call graph construction test**
- **No file removal test**
- **No re-export (`pub use`) tests**
- No trait generics/bounds, lifetimes, macros, enum variants/match, async/await
- No multi-file trait implementations

## Actions

1. Add Rust incremental update, call graph, and file removal tests (parity with other languages)
2. Add Rust `pub use` re-export test
3. Wire up orphaned fixture files or clean them up
4. Tests should use fixtures (following existing `project.*.integration.test.ts` pattern)
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

## Weak Assertion Remediation

Some project integration tests have loose assertions:

- Call graph tests that only check edge count but not exact source→target pairs
- Tests that check `definitions.size > 0` without verifying specific definition names
- Incremental update tests that verify "something changed" but not exact before/after state

All new tests must use exact value assertions. Existing tests with weak assertions should be strengthened when touched.

<!-- SECTION:NOTES:END -->
