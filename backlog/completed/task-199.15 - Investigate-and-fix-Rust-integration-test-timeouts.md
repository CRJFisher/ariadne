---
id: TASK-199.15
title: "Fix: Rust integration test timeouts in project.rust.integration.test.ts"
status: Done
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - bugfix
  - testing
  - rust
dependencies: []
references:
  - packages/core/src/project/project.rust.integration.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Three tests in `project.rust.integration.test.ts` are timing out:

1. `"should detect callback context for closures in iterator methods"`
2. `"should NOT mark external callbacks as entry points"`
3. `"should resolve symbols through pub use re-exports"`

These failures predate the task-199 epic work and were surfaced during the 199.8.1 review.

### Actions

1. Run each failing test in isolation to reproduce the timeout
2. Determine whether the tests are hanging (infinite loop / deadlock) or just slow (need higher timeout)
3. If hanging: identify the root cause (likely in callback detection or pub use resolution logic)
4. Fix the underlying issue or the test setup, whichever is broken
5. Ensure all 3 tests pass reliably
<!-- SECTION:DESCRIPTION:END -->

## Implementation Summary

**Root cause:** The three slow tests each created their own `new Project()` and called `initialize()` with no path argument. This defaults to `process.cwd()` (the monorepo root), causing `get_file_tree()` to recursively walk the entire repo including `node_modules`, `.git`, worktrees, etc. — taking ~3.3s per test, right at the 5s timeout edge.

**Fix:** Removed the redundant `new Project()` + `initialize()` calls. These tests now reuse the shared `project` from `beforeEach`, which is already initialized with `FIXTURE_ROOT` (a small directory). Synthetic file paths use `/tmp/ariadne_test/` to avoid triggering Rust test-file detection (which matches paths containing `/tests/`).

**Result:** All three tests dropped from ~3000ms to ~4ms each. All 81 tests pass.
