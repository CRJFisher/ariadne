---
id: task-100.23
title: Add focused unit tests for import resolution
status: To Do
assignee: []
created_date: '2025-08-05 21:16'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Create comprehensive unit tests for import resolution logic once it's extracted into ImportResolver. Currently import resolution lacks proper unit test coverage, making it difficult to verify correctness and catch regressions during refactoring.

## Acceptance Criteria

- [ ] Tests for named imports (import { foo } from 'module')
- [ ] Tests for default imports (import foo from 'module')
- [ ] Tests for renamed imports (import { foo as bar } from 'module')
- [ ] Tests for circular imports and proper error handling
- [ ] Tests for missing imports and module not found scenarios
- [ ] Tests for module resolution across different supported languages
- [ ] 90%+ code coverage for ImportResolver service
- [ ] Integration tests for common import resolution workflows
