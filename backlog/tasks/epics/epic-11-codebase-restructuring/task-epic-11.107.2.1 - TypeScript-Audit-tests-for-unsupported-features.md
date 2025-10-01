---
id: task-epic-11.107.2.1
title: 'TypeScript: Audit tests for unsupported features'
status: To Do
assignee: []
created_date: '2025-10-01 10:27'
labels: []
dependencies: []
parent_task_id: task-epic-11.107.2
priority: high
---

## Description

Review semantic_index.typescript.test.ts to identify and remove:
- Tests for TypeScript-specific features we don't need (advanced generics, complex type operators, etc.)
- Tests that would require unnecessary TypeScript compiler integration
- Overly specific edge cases

Focus on essential TypeScript features for call graph analysis.
