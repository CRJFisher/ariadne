---
id: task-68
title: Add type inference for function returns and parameters
status: To Do
assignee: []
created_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - type-inference
dependencies:
  - task-67
---

## Description

Implement basic type inference to track types through function returns and parameter passing. This enables tracking when getInstance() returns a class instance or when objects are passed between functions. Required for complete cross-file type tracking.

## Acceptance Criteria

- [ ] Function return types are inferred from return statements
- [ ] Parameter types are tracked when calling functions
- [ ] Type information flows through assignment chains
- [ ] Method chaining is supported (obj.method1().method2())
- [ ] Tests verify type inference scenarios
- [ ] Performance remains acceptable
