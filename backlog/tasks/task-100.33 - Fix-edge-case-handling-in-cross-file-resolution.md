---
id: task-100.33
title: Fix edge case handling in cross-file resolution
status: To Do
assignee: []
created_date: '2025-08-05 22:38'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Multiple edge cases are failing: self-referential imports, multi-level method calls across files, recursive function calls across files, namespace imports with nested access, and missing file/import handling. These suggest issues with complex cross-file resolution scenarios.

## Acceptance Criteria

- [ ] Self-referential imports are handled correctly
- [ ] Multi-level method calls are tracked across files
- [ ] Recursive calls are tracked across files
- [ ] Namespace imports work correctly
- [ ] Missing files/imports are handled gracefully
