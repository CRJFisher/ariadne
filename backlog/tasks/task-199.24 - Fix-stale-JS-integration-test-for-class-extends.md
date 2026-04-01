---
id: TASK-199.24
title: Fix stale JS integration test for class extends
status: To Do
assignee: []
created_date: "2026-04-01 15:10"
labels:
  - test-coverage
  - javascript
  - integration-test
dependencies: []
references:
  - >-
    packages/core/src/index_single_file/query_code_tree/capture_handlers/capture_handlers.javascript.ts
  - packages/core/src/project/project.javascript.integration.test.ts
parent_task_id: TASK-199
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

The JS integration test in `project.javascript.integration.test.ts` (lines 885-922) uses `class Child extends Base` but:

1. Contains a stale comment: "JavaScript class inheritance tracking (`extends` extraction) is not yet implemented" — this was fixed in TASK-199.19
2. Does not assert that `Child.extends` contains `"Base"` — it only checks that `Base.helper` is referenced

Add an assertion verifying the `extends` field is correctly populated through the full project pipeline, and remove the stale comment.

<!-- SECTION:DESCRIPTION:END -->
