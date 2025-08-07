---
id: task-100.28
title: Fix get_source_code regression
status: To Do
assignee: []
created_date: '2025-08-05 22:33'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

get_source_code is returning just the function name instead of the full source code. The method is not properly extracting the source based on the definition range.

## Acceptance Criteria

- [ ] get_source_code returns full function/class source
- [ ] get_source_with_context returns proper context
- [ ] All source extraction tests pass
