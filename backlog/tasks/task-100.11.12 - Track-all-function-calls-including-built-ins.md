---
id: task-100.11.12
title: Track all function calls including built-ins
status: To Do
assignee: []
created_date: '2025-08-04 19:00'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Currently, Ariadne only tracks calls to functions defined within the project. This misses calls to built-in functions (console.log, JSON.stringify) and methods on built-in types (string.trim, array.push), resulting in a low nodes-with-calls percentage (36.9% vs 85% threshold).

## Acceptance Criteria

- [ ] All function calls are tracked, including built-ins
- [ ] Method calls on built-in types are counted
- [ ] Nodes-with-calls percentage improves significantly
- [ ] Tests verify built-in call tracking

## Implementation Plan

1. Modify call analysis to track all AST call expressions
2. Create placeholder definitions for unresolved calls
3. Update call counting logic
4. Test with real codebase to verify improvement