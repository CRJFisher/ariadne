---
id: task-epic-11.100.0.5.19.2
title: Delete old duplicate type definitions
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['cleanup', 'type-system']
dependencies: ['task-epic-11.100.0.5.19.1']
parent_task_id: task-epic-11.100.0.5.19
priority: high
---

## Description

Delete the old type definitions that have been replaced by the new unified types.

## Types to Delete

From various files, remove:
- Old `ImportInfo` type (replaced by `Import`)
- Old `ExportInfo` type (replaced by `Export`)
- Old `FunctionCallInfo` (replaced by `CallInfo`)
- Old `MethodCallInfo` (replaced by `CallInfo`)
- Old `ConstructorCallInfo` (replaced by `CallInfo`)
- Old `TypeInfo` arrays (replaced by `TrackedType`)
- Old `ImportedClassInfo` (replaced by import types)
- Duplicate `TypeDefinition` in types.ts (we have new one)
- Old `SymbolDefinition` (replaced by new `SymbolDefinition`)
- Old `ScopeTree` types (replaced by `ScopeDefinition`)

## Files to Check

- `packages/types/src/modules.ts`
- `packages/types/src/calls.ts`
- `packages/types/src/types.ts`
- `packages/types/src/symbols.ts`
- `packages/types/src/scopes.ts`
- `packages/types/src/import_export.ts`

## Acceptance Criteria

- [ ] No duplicate type definitions remain
- [ ] All old types removed or marked deprecated
- [ ] Compilation succeeds
- [ ] Document any types kept for backward compatibility