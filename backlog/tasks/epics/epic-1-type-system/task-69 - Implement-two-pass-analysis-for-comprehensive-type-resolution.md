---
id: task-69
title: Implement two-pass analysis for comprehensive type resolution
status: To Do
assignee: []
created_date: '2025-08-02'
labels:
  - enhancement
  - call-graph
  - architecture
dependencies:
  - task-67
---

## Description

Refactor the call graph building to use a two-pass approach: first collect all type information and imports across the project, then resolve method calls using the collected data. This architectural change enables proper cross-file type tracking. See docs/cross-file-method-resolution.md for rationale.

## Acceptance Criteria

- [ ] First pass collects all class definitions and imports
- [ ] First pass tracks all constructor calls and type assignments
- [ ] Second pass resolves method calls using collected type data
- [ ] Existing single-pass functionality preserved as fallback
- [ ] Tests verify two-pass produces same results for existing cases
- [ ] Tests verify new cross-file capabilities work correctly
