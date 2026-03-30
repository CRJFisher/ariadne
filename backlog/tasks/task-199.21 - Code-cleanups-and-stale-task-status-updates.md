---
id: TASK-199.21
title: "Code cleanups and stale task status updates"
status: To Do
assignee: []
created_date: "2026-03-30 14:00"
labels:
  - housekeeping
  - cleanup
dependencies: []
parent_task_id: TASK-199
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Small cleanups and doc updates accumulated during the task-199 epic.

### Code Cleanups

1. **Dead debug code in `extract_is_optional_chain`** — `metadata_extractors.javascript.ts` has a `debug` flag set to `false` with several `console.log` calls (lines 562-614). Remove the flag and all guarded console.logs. Found in task 199.4.1.

2. **Stale test comment in `create_enum_id`** — `symbol_factories.python.test.ts` line 297 says "create_enum_id manually formats the string instead of using enum_symbol()" which describes the pre-fix behavior. Update to reflect the current (fixed) implementation. Found in task 199.3.1.

3. **Content re-read redundancy in `try_restore_from_cache`** — `load_project.ts`: `try_restore_from_cache` reads the file from disk (line 347) even when the caller in the content-hash path has already read the content (line 200). Thread the content through to avoid the redundant read. Found in task 199.9.1.

### Stale Task Doc Statuses

Update the status field to "Done" in these task documents:

- task-199.1 (currently "To Do")
- task-199.2 (currently "To Do")
- task-199.3 (currently "To Do")
- task-199.5 (currently "To Do")
- task-199.6 (currently "In Progress")
- task-199.6.2 (currently "To Do")
- task-199.9 (currently "To Do")
- task-199.10 (currently "To Do")

### Actions

1. Remove dead debug code from `extract_is_optional_chain`
2. Fix stale comment in `create_enum_id` test
3. Thread file content through `try_restore_from_cache` to avoid redundant disk read
4. Update all 8 stale task statuses to "Done"
<!-- SECTION:DESCRIPTION:END -->
