---
id: task-100.22
title: Refactor CallAnalyzer to use clear two-phase separation
status: To Do
assignee: []
created_date: '2025-08-05 21:16'
labels: []
dependencies: []
parent_task_id: task-100
---

## Description

Simplify analyze_calls_from_definition() by clearly separating type discovery and call resolution phases. Currently the method mixes constructor analysis, type discovery, and reference resolution in a way that makes the data flow unclear and testing difficult.

## Acceptance Criteria

- [ ] Clear separation between constructor/type analysis phase and reference resolution phase
- [ ] Simplified data flow between phases with well-defined interfaces
- [ ] Reduced coupling between phases to improve testability
- [ ] Better testability of each phase in isolation
- [ ] Documentation of the two-phase approach and data flow
- [ ] Maintained functionality while improving code structure
