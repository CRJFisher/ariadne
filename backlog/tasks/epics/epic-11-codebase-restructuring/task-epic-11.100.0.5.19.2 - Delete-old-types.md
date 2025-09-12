---
id: task-epic-11.100.0.5.19.2
title: Delete old duplicate type definitions
status: Completed
assignee: []
created_date: "2025-01-12"
labels: ["cleanup", "type-system"]
dependencies: ["task-epic-11.100.0.5.19.1"]
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
- `packages/types/src/calls_old.ts`
- `packages/types/src/types.ts`
- `packages/types/src/symbols.ts`
- `packages/types/src/scopes.ts`
- `packages/types/src/import_export_old.ts`

## Acceptance Criteria

- [x] No duplicate type definitions remain
- [x] All old types removed or marked deprecated
- [x] Compilation succeeds (pre-existing errors unrelated to this task)
- [x] Document any types kept for backward compatibility

## Completion Notes

Successfully deleted old duplicate type definitions:
- Deleted `calls_old.ts` file
- Deleted `import_export_old.ts` file
- Kept `ImportInfo` and `ExportInfo` in modules.ts marked as deprecated
- Kept `ImportedClassInfo` in types.ts marked as deprecated
- Updated codegraph.ts to use new type names
- Removed exports from deleted files in index.ts

The remaining build errors are pre-existing issues related to missing type guard implementations and undefined types that need to be addressed in separate tasks.
