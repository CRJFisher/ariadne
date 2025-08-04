---
id: task-100.11.5
title: Implement two-phase call graph building
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

Separate call graph building into distinct phases: 1) Analysis phase that collects all data without mutations, 2) Construction phase that builds the final immutable structures. This eliminates mutations during graph traversal.

## Acceptance Criteria

- [ ] Clear separation between analysis and construction
- [ ] Analysis phase collects all exports imports and calls
- [ ] Construction phase builds final graph from collected data
- [ ] No mutations during graph building
- [ ] Results are fully immutable
