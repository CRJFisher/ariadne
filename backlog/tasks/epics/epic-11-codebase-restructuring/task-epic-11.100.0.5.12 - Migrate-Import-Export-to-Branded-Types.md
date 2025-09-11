---
id: task-epic-11.100.0.5.12
title: Migrate Import Export to Branded Types
status: Complete
assignee: []
created_date: '2025-09-11 18:35'
labels: []
dependencies: ['task-epic-11.100.0.5.9', 'task-epic-11.100.0.5.10']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Replace all raw strings in import/export types with appropriate branded types including ModulePath, SymbolName, and NamespaceName.

## Acceptance Criteria

- [x] All `source: string` replaced with `source: ModulePath`
- [x] All `name: string` replaced with `name: SymbolName`
- [x] All `alias?: string` replaced with `alias?: ImportName`
- [x] All `namespace_name?: string` replaced with `namespace_name?: NamespaceName`
- [x] Type guards implemented for all branded types
- [x] Full test coverage for type conversions

## Scope

### Current Issues

```typescript
// BEFORE - Unsafe
interface ImportInfo {
  readonly name: string;
  readonly source: string;
  readonly alias?: string;
  readonly namespace_name?: string;
}

// AFTER - Type-safe
interface ImportInfo {
  readonly name: SymbolName;
  readonly source: ModulePath;
  readonly alias?: ImportName;
  readonly namespace_name?: NamespaceName;
}
```

## Affected Modules

- import_resolution
- export_detection
- namespace_resolution
- module_graph

## Dependencies

- Depends on Task 11.100.0.5.9 (Branded Type Infrastructure)
- Depends on Task 11.100.0.5.10 (Compound Type Builders)

## Implementation Notes

### Completed: 2025-09-11

Import/Export types were already migrated to branded types during task 11.100.0.5.4:

1. **unified-import-export-types.ts uses**:
   - `ModulePath` for all module sources
   - `SymbolName` for all symbol names and aliases
   - `NamespaceName` for namespace imports
   - `SymbolId` for symbol identifiers

2. **All import types use branded types**:
   - NamedImport: uses SymbolName for names and aliases
   - DefaultImport: uses SymbolName for default import name
   - NamespaceImport: uses NamespaceName for namespace alias
   - All use ModulePath for source module

3. **All export types use branded types**:
   - NamedExport: uses SymbolName for local and export names
   - DefaultExport: uses SymbolName for exported symbol
   - NamespaceExport: uses ModulePath and NamespaceName
   - ReExport: uses SymbolName and ModulePath

4. **Additional improvements**:
   - Added ModulePath builder/parser in task 10
   - Type guards implemented for all types
   - Helper functions for symbol extraction