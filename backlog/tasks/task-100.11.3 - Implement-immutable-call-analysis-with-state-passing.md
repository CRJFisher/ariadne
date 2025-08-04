---
id: task-100.11.3
title: Implement immutable call analysis with state passing
status: To Do
assignee: []
created_date: '2025-08-04 14:17'
labels:
  - immutable
  - refactoring
dependencies: []
parent_task_id: task-100.11
---

## Description

Refactor get_calls_from_definition and get_module_level_calls to use immutable state passing. Instead of mutating type trackers during analysis, return analysis results that include any discovered type information.

## Acceptance Criteria

- [ ] Call analysis functions return results with type discoveries
- [ ] No mutations during call analysis
- [ ] Type information flows through return values
- [ ] Constructor detection returns type assignments
- [ ] Method resolution is pure functional
