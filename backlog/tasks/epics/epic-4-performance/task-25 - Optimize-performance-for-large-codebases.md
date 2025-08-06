---
id: task-25
title: Optimize performance for large codebases
status: To Do
assignee: []
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies:
  - task-19
  - task-21
  - task-26
---

## Description

Ensure all new APIs perform well on large codebases by implementing caching and lazy evaluation where appropriate.

## Acceptance Criteria

- [ ] Call graph extraction scales to 10k+ functions
- [ ] Scope graph access is O(1) via caching
- [ ] Function discovery uses indices for fast lookup
- [ ] Memory usage is reasonable for large projects
- [ ] Performance benchmarks document results
