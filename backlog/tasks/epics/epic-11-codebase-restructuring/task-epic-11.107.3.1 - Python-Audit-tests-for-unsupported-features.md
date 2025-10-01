---
id: task-epic-11.107.3.1
title: 'Python: Audit tests for unsupported features'
status: To Do
assignee: []
created_date: '2025-10-01 10:27'
labels: []
dependencies: []
parent_task_id: task-epic-11.107.3
priority: high
---

## Description

Review semantic_index.python.test.ts to identify and remove:
- Tests for advanced Python features we don't need (metaclasses, descriptors, etc.)
- Tests requiring deep type inference
- Overly specific edge cases

Focus on essential Python features for call graph analysis.
