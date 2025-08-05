---
id: task-100.15.3
title: Extract constructor analysis from call_analysis.ts
status: To Do
assignee: []
created_date: '2025-08-05 14:07'
labels: []
dependencies: []
parent_task_id: task-100.15
---

## Description

Extract the analyze_constructor_call function and related logic into constructor_analysis.ts. This handles detection of constructor calls and type discovery for variable assignments.

## Acceptance Criteria

- [ ] Create call_analysis/constructor_analysis.ts with analyze_constructor_call
- [ ] Function returns immutable TypeDiscovery arrays
- [ ] Update imports to use new module location
- [ ] All constructor detection tests pass
