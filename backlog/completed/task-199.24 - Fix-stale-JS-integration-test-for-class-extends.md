---
id: TASK-199.24
title: Fix stale JS integration test for class extends
status: Done
assignee: []
created_date: "2026-04-01 15:10"
updated_date: "2026-04-15 21:09"
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Removed stale comment about `extends` extraction not being implemented (it was already implemented via `extract_extends` in `handle_definition_class`). Added assertions to verify:

1. `Child` class is found in the index
2. `child_type_info.extends` equals `["Base"]` through the full project pipeline via `get_type_info`
3. Existing `Base.helper` reference check preserved

Test passes: `Polymorphic this Dispatch > should resolve this.method() to base method in ES6 class`

<!-- SECTION:FINAL_SUMMARY:END -->
