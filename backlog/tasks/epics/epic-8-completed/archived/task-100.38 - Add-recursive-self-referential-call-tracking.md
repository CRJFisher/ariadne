---
id: task-100.38
title: Add recursive/self-referential call tracking
status: To Do
assignee: []
created_date: '2025-08-06 08:07'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Functions that call themselves (directly or indirectly) are not tracked in the call graph. This affects both same-file and cross-file recursive patterns. Need to detect when a function calls itself and add those to the call graph.

## Acceptance Criteria

- [ ] Recursive function calls are detected and tracked
- [ ] Self-referential imports work correctly
- [ ] Call graph includes recursive call edges
- [ ] Tests for recursive patterns pass
