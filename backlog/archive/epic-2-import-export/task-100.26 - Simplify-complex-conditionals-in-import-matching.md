---
id: task-100.26
title: Simplify complex conditionals in import matching
status: To Do
assignee: []
created_date: '2025-08-05 21:17'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Refactor the multi-level fallback logic in follow_import() to be more maintainable and easier to understand. The current implementation has deep nesting and complex conditional logic that makes it difficult to follow the fallback strategies and debug issues.

## Acceptance Criteria

- [ ] Fallback strategies clearly documented with examples
- [ ] Each fallback strategy extracted into its own named method
- [ ] Maximum nesting depth of 2 levels in any method
- [ ] Clear error handling for each fallback level with descriptive messages
- [ ] Unit tests for each fallback strategy
- [ ] Performance maintained or improved after refactoring
- [ ] Clear logging/debugging support for fallback decision making
