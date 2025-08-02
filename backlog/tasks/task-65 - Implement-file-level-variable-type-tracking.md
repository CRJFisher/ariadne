---
id: task-65
title: Implement file-level variable type tracking
status: To Do
assignee: []
created_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - type-tracking
dependencies:
  - task-64
---

## Description

Refactor variable type tracking to persist at the file level rather than function level. Currently, type information is lost between function calls because variableTypes map is local to get_calls_from_definition(). This is the first step to enable cross-file method resolution.

## Acceptance Criteria

- [ ] Variable types tracked at file scope
- [ ] Type information persists across function boundaries within same file
- [ ] Existing same-file method resolution continues to work
- [ ] Tests verify type persistence across functions
- [ ] Performance impact is minimal
