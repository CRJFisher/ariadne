---
id: task-epic-11.100.0.5.19.3
title: Reorganize branded types into functional groups
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-organization', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.1']
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Distribute branded types from `branded-types.ts` into their relevant functional modules instead of grouping them all together.

## Distribution Plan

### To `import_export_types.ts`:
- `ModulePath` and related functions
- `NamespaceName` and related functions

### To `symbol_scope_types.ts`:
- `SymbolName`, `SymbolId` and related functions
- `ScopePath` and related functions
- `Visibility` type

### To `type_analysis_types.ts`:
- `TypeExpression` and related functions
- `TypeName` and related functions
- `ResolvedTypeKind`

### To `call_types.ts`:
- `CallerContext`, `CalleeName`, `ReceiverName`
- `ClassName` (for constructor calls)

### To `base_query_types.ts`:
- `SourceCode`, `FilePath` and related functions
- `DocString`

### Common/shared branded types:
Consider keeping truly shared types in a `common_types.ts`

## Acceptance Criteria

- [ ] Each branded type is in its functionally relevant file
- [ ] No circular dependencies created
- [ ] Type guards and builders co-located with types
- [ ] Delete empty `branded-types.ts` file
- [ ] Update all imports