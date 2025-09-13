---
id: task-epic-11.100.0.5.19.11.1
title: Fix type_tracking TypeInfo export issue
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['typescript-error', 'type-exports']
dependencies: ['task-epic-11.100.0.5.19.11']
parent_task_id: task-epic-11.100.0.5.19.11
priority: high
---

## Description

Fix TypeScript compilation errors in type_tracking module related to TypeInfo export issues.

## Errors to Fix

### 1. TypeInfo Export Issue
Files:
- `src/type_analysis/type_tracking/type_tracking.typescript.ts`
- `src/type_analysis/type_tracking/type_tracking_utils.ts`

Error:
```
Module '"./type_tracking"' declares 'TypeInfo' locally, but it is not exported.
```

### 2. ImportInfo Missing Export
File: `src/type_analysis/type_tracking/type_tracking.typescript.integration.test.ts`

Error:
```
Module '"@ariadnejs/types"' has no exported member 'ImportInfo'.
```

## Solution

1. **Remove local TypeInfo interface** from type_tracking.ts since it conflicts with the exported TypeInfo from @ariadnejs/types
2. **Update imports** to use TypeInfo from @ariadnejs/types consistently
3. **Replace ImportInfo usage** with proper import types from @ariadnejs/types
4. **Ensure consistent type usage** across the module

## Acceptance Criteria

- [ ] No TypeScript compilation errors related to TypeInfo exports
- [ ] All files import TypeInfo from @ariadnejs/types consistently
- [ ] ImportInfo usage replaced with proper import types
- [ ] Type_tracking module compiles successfully