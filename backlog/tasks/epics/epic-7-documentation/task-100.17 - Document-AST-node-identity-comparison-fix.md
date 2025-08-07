---
id: task-100.17
title: Document AST node identity comparison fix
status: To Do
assignee: []
created_date: '2025-08-05 13:46'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

The fix comments in call_analysis.ts explain an important architectural issue where Tree-sitter reparses AST nodes when files are added, breaking object identity comparisons. This should be documented properly rather than left as inline fix comments.

## Acceptance Criteria

- [ ] Capture and document this functionality with comprehensive tests
- [ ] Fix comments converted to proper documentation
- [ ] Architecture decision documented in backlog/decisions
- [ ] Code comments explain the position-based comparison approach
- [ ] No functional changes
