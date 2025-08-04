---
id: task-100.12.4
title: Extract call graph operations from Project class
status: To Do
assignee: []
created_date: '2025-08-04 22:40'
labels: []
dependencies: []
parent_task_id: task-100.12
---

## Description

Move all call graph related methods into a separate CallGraphService module, using the already immutable call graph data structures.

## Acceptance Criteria

- [ ] CallGraphService class created
- [ ] Call graph methods moved
- [ ] Call analysis logic moved
- [ ] Module-level call detection moved
- [ ] Project class delegates to CallGraphService
