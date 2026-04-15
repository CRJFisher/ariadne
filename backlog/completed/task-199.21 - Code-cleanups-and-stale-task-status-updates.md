---
id: TASK-199.21
title: Code cleanups and stale task status updates
status: Done
assignee: []
created_date: "2026-03-30 14:00"
updated_date: "2026-04-01 21:34"
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

Uuse the backlog mcp tool to mark these as "Done":

- task-199.1 (currently "To Do")
- task-199.2 (currently "To Do")
- task-199.3 (currently "To Do")
- task-199.5 (currently "To Do")
- task-199.6 (currently "In Progress")
- task-199.6.2 (currently "To Do")
- task-199.9 (currently "To Do")
- task-199.10 (currently "To Do")
- etc

### Actions

1. Remove dead debug code from `extract_is_optional_chain`
2. Fix stale comment in `create_enum_id` test
3. Thread file content through `try_restore_from_cache` to avoid redundant disk read
4. Update all 8 stale task statuses to "Done"
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

## Summary\n\n### Code Cleanups\n\n1. **Removed dead debug code from `extract_is_optional_chain`** — Removed the `debug` flag and all 18 lines of guarded `console.log` calls from `metadata_extractors.javascript.ts`. Function logic preserved exactly.\n\n2. **Fixed stale test comment in `create_enum_id`** — Updated comment in `symbol_factories.python.test.ts` to reflect that `create_enum_id` delegates to `enum_symbol()` (not manually formatting the string).\n\n3. **Threaded file content through `try_restore_from_cache`** — Added optional `existing_content` parameter to `try_restore_from_cache` in `load_project.ts`. The content-hash fallback path now passes the already-read content, avoiding a redundant `fs.readFile`. The git fast path continues to read from disk (no content available at that point).\n\n### Stale Task Status Updates\n\nMarked 8 tasks as Done and completed: TASK-199.1, 199.2, 199.3, 199.5, 199.6, 199.6.2, 199.9, 199.10.\n\n### Verification\n\nAll 193 tests pass across the 3 changed files. Three independent sonnet agents verified each change with no issues found.

<!-- SECTION:FINAL_SUMMARY:END -->
