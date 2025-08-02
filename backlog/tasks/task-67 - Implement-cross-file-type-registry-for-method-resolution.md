---
id: task-67
title: Implement cross-file type registry for method resolution
status: To Do
assignee: []
created_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - cross-file
dependencies:
  - task-66
---

## Description

Create a project-wide type registry that maintains variable type information across file boundaries. This registry will enable method calls on imported class instances to be resolved to their definitions in other files. See docs/cross-file-method-resolution.md for current limitations.

## Acceptance Criteria

- [ ] Global type registry tracks variable types across files
- [ ] Method calls on imported instances resolve correctly
- [ ] Registry handles variable reassignments
- [ ] Memory usage remains reasonable for large projects
- [ ] Tests verify cross-file method resolution for all languages
- [ ] Call graph shows correct method relationships across files
