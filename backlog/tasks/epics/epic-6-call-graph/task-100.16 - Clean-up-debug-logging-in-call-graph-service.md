---
id: task-100.16
title: Clean up debug logging in call graph service
status: To Do
assignee: []
created_date: '2025-08-05 13:46'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Remove temporary debug logging that was added during debugging of built-in call preservation issue. The logging uses DEBUG_CALL_GRAPH environment variable and includes specific function name checks.

## Acceptance Criteria

- [ ] All DEBUG_CALL_GRAPH logging removed from call_graph_service.ts
- [ ] Debug comments removed
- [ ] No functional changes
- [ ] All tests pass
