---
id: task-100.11.2
title: Create immutable import/export detection module
status: To Do
assignee: []
created_date: '2025-08-04 14:17'
labels:
  - immutable
  - refactoring
dependencies: []
parent_task_id: task-100.11
---

## Description

Refactor import and export detection to use pure functions that return results instead of mutating state. The detect_file_exports function should return export data rather than modifying trackers directly.

## Acceptance Criteria

- [ ] detect_file_exports returns export data structure
- [ ] initialize_file_imports returns import data
- [ ] No direct mutations to trackers or registry
- [ ] Functions are pure and testable
- [ ] Clear separation of detection from registration
