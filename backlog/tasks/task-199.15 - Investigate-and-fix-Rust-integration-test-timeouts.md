---
id: TASK-199.15
title: "Fix: Rust integration test timeouts in project.rust.integration.test.ts"
status: To Do
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
