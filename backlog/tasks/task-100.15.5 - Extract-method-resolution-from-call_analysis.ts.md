---
id: task-100.15.5
title: Extract method resolution from call_analysis.ts
status: To Do
assignee: []
created_date: '2025-08-05 14:08'
labels: []
dependencies: []
parent_task_id: task-100.15
---

## Description

Extract method-specific resolution functions (resolve_method_call_pure, resolve_method_on_type, is_method_of_class) into method_resolution.ts. These handle resolution of method calls on objects and type checking.

## Acceptance Criteria

- [ ] Create method_resolution.ts with extracted functions
- [ ] Functions use immutable MethodResolutionResult
- [ ] Update imports in call_analysis.ts
- [ ] All method resolution tests pass
