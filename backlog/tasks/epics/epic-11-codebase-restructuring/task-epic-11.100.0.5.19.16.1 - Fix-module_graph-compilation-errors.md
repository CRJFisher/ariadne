---
id: task-epic-11.100.0.5.19.16.1
title: Fix compilation errors in module_graph.ts
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-fix', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.16']
parent_task_id: task-epic-11.100.0.5.19.16
priority: high
---

## Description

The existing `module_graph.ts` file has compilation errors due to references to old types that no longer exist.

## Issues Identified

### Missing Types
- `ImportStatement` - no longer exists in @ariadnejs/types
- `ExportStatement` - no longer exists in @ariadnejs/types

### Compilation Errors
```
src/import_export/module_graph/module_graph.ts(12,3): error TS2305: Module '"@ariadnejs/types"' has no exported member 'ImportStatement'.
src/import_export/module_graph/module_graph.ts(13,3): error TS2305: Module '"@ariadnejs/types"' has no exported member 'ExportStatement'.
src/import_export/module_graph/module_graph.ts(239,3): error TS2322: Type 'string' is not assignable to type 'FilePath'.
```

## Changes Required

1. **Replace old import types**: Update imports to use new `Import` and `Export` discriminated union types
2. **Update function signatures**: Change parameters from old types to new types
3. **Fix type assignments**: Ensure proper FilePath type usage
4. **Update implementation**: Adapt code to work with new discriminated union structure

## Acceptance Criteria

- [ ] File compiles without errors
- [ ] All type imports use new discriminated union types
- [ ] Function signatures updated to use new types
- [ ] Implementation adapted for new type structure
- [ ] Existing tests still pass after changes