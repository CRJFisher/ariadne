---
id: task-18
title: Migrate test runner from Jest to Vitest
status: To Do
assignee: []
created_date: '2025-07-16'
labels:
  - testing
  - infrastructure
dependencies:
  - task-17
---

## Description

After investigation in task 17, we identified that Jest has a fundamental incompatibility with tree-sitter native modules on Linux (Jest issue #9206). This prevents CI tests from passing. Vitest is a modern test runner with excellent native module support through its 'forks' pool, making it ideal for our use case.

## Acceptance Criteria

- [ ] All existing tests migrated to Vitest
- [ ] Tests pass on both macOS and Linux CI
- [ ] Vitest configuration optimized for native modules
- [ ] Remove Jest dependencies and configuration
- [ ] Update CI workflow to use Vitest
- [ ] Document migration guide
