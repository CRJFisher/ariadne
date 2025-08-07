---
id: task-100.15.2
title: Extract call detection functions from call_analysis.ts
status: To Do
assignee: []
created_date: '2025-08-05 14:07'
labels: []
dependencies: []
parent_task_id: task-100.15
---

## Description

Extract call pattern detection functions (is_method_call_pattern, is_reference_called) into call_detection.ts. The is_reference_called function contains the critical AST node identity fix that must be preserved.

## Acceptance Criteria

- [ ] Create call_analysis/call_detection.ts with extracted functions
- [ ] Preserve AST node identity fix with proper documentation
- [ ] Update imports to use new module location
- [ ] All tests pass
