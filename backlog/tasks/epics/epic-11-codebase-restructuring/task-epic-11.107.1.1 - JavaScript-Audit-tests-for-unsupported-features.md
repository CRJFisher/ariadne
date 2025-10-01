---
id: task-epic-11.107.1.1
title: 'JavaScript: Audit tests for unsupported features'
status: To Do
assignee: []
created_date: '2025-10-01 10:27'
labels: []
dependencies: []
parent_task_id: task-epic-11.107.1
priority: high
---

## Description

Review semantic_index.javascript.test.ts to identify and remove:
- Tests for language features we don't need to support
- Tests that would require adding unnecessary functionality
- Overly complex edge cases that cause code rot

Focus on essential JavaScript features for call graph analysis.
