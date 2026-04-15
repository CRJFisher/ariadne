---
id: TASK-199.6.2
title: Add TypeScript enum and Rust associated function construction tests
status: Done
assignee: []
created_date: "2026-03-30 10:45"
updated_date: "2026-04-01 21:33"
labels:
  - testing
  - type-preprocessing
dependencies: []
parent_task_id: TASK-199.6
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Add two missing test scenarios identified in the TASK-199.6 evaluation: TypeScript enum extraction and Rust `Type::new()` associated function construction.

## Actions

1. **Add TypeScript enum extraction test** — currently enums are only tested via Rust. Add a test in the appropriate test file (likely `member.test.ts` for enum member extraction, or `alias.test.ts` if testing enum type metadata) that verifies TypeScript enum members are extracted correctly with exact value assertions.

2. **Add Rust `Type::new()` associated function construction test** — add a test in `constructor.test.ts` that verifies the idiomatic Rust pattern `let x = Type::new(...)` is captured as a constructor binding. This is the most common Rust construction pattern and is currently untested.

3. **Fix production bugs** discovered while improving tests: if straightforward, spin up an opus sub-agent to fix the bug. Then ensure the test assertions lock in the corrected behaviour — the test must fail if the fix is reverted. Only create a backlog task if the fix is complex and requires user decisions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

### TypeScript enum test

The TypeScript `.scm` query already has enum capture rules (recently fixed in this branch to remove duplicate parent-node captures). The test should verify that enum members are extracted and their names/values are correct.

Test files:

- `packages/core/src/index_single_file/type_preprocessing/member.test.ts` — for enum member extraction via `extract_type_members`
- `packages/core/src/index_single_file/type_preprocessing/alias.test.ts` — if testing enum type alias metadata

### Rust `Type::new()` test

The test should use `extract_constructor_bindings` in `constructor.test.ts`. Verify that `let db = Database::new()` produces a constructor binding mapping the variable to `"Database"`.

<!-- SECTION:NOTES:END -->
