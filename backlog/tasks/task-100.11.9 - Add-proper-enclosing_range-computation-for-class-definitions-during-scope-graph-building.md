---
id: task-100.11.9
title: >-
  Add proper enclosing_range computation for class definitions during scope
  graph building
status: To Do
assignee: []
created_date: '2025-08-04 16:43'
labels: []
dependencies: []
parent_task_id: task-100.11
---

## Description

Currently, enclosing_range is only set for functions in scope_resolution.ts, not for classes. This forces workarounds like symbol_id matching instead of range checking. The fix should ensure all definition types have proper enclosing_range set during scope graph building.

## Acceptance Criteria

- [ ] Class definitions have enclosing_range set in scope_resolution.ts
- [ ] Method resolution can use range checking instead of symbol_id matching
- [ ] All language-specific class patterns are handled (TypeScript/JavaScript classes
- [ ] Python classes
- [ ] Rust structs/impl blocks)
