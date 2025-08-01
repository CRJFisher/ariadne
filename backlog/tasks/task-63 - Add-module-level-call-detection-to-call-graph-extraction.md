---
id: task-63
title: Add module-level call detection to call graph extraction
status: To Do
assignee: []
created_date: '2025-08-01'
labels:
  - call-graph
  - enhancement
dependencies: []
---

## Description

Call graph extraction currently only detects function calls made within function bodies. It does not detect calls made at the module level (top-level script code). This causes functions that are only called from module-level code to be incorrectly identified as top-level nodes.

## Acceptance Criteria

- [ ] Module-level function calls are detected and included in call graph
- [ ] Functions called from module-level code are not marked as top-level nodes
- [ ] Test coverage for module-level call detection
