---
id: task-100.15.6
title: Extract types and create call_analysis_core.ts
status: To Do
assignee: []
created_date: '2025-08-05 14:08'
labels: []
dependencies: []
parent_task_id: task-100.15
---

## Description

Create call_analysis_types.ts with all interfaces, then refactor the remaining analyze_calls_from_definition and analyze_module_level_calls into a slim call_analysis_core.ts that orchestrates the other modules.

## Acceptance Criteria

- [ ] Create call_analysis_types.ts with all interfaces
- [ ] Create call_analysis_core.ts with main analysis functions
- [ ] Original call_analysis.ts can be deleted
- [ ] All tests pass with new module structure
- [ ] Total size of all modules is under 28KB each
