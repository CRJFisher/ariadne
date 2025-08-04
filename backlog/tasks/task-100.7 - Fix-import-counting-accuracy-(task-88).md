---
id: task-100.7
title: Fix import counting accuracy (task-88)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
labels: []
dependencies:
  - task-88
parent_task_id: task-100
---

## Description

Import counting currently counts word occurrences instead of actual import statements. This inflates import counts and affects validation accuracy. Example: graph.ts shows 27 imports but only has 2 actual statements.

## Acceptance Criteria

- [ ] Import count reflects actual import statements
- [ ] ScopeGraph.getAllImports() returns correct data
- [ ] File summary import counts are accurate
