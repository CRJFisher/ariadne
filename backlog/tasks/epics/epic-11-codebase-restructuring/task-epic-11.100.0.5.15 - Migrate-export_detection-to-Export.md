---
id: task-epic-11.100.0.5.15
title: Migrate export_detection to Export
status: To Do
assignee: []
created_date: '2025-09-12'
labels: ['type-harmonization', 'refactoring']
dependencies: ['task-epic-11.100.0.5.4']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Update the export_detection module to directly produce Export types from AST traversal, eliminating the need for the ExportInfo → ExportStatement adapter.

## Background

Currently we have duplicate type definitions:
- `ExportInfo` (internal type used during extraction)
- `ExportStatement` (public API type)
- `convert_export_info_to_statement()` adapter function

This duplication serves no purpose and adds complexity.

## Acceptance Criteria

- [ ] export_detection module returns `Export[]` instead of `ExportInfo[]`
- [ ] Module uses discriminated unions (NamedExport, DefaultExport, etc.)
- [ ] All branded types used (ModulePath, SymbolName)
- [ ] Handles re-exports correctly with ReExport type
- [ ] No intermediate ExportInfo type needed
- [ ] Tests updated to verify Export output
- [ ] File size remains under 32KB limit

## Implementation Strategy

```typescript
// BEFORE: Returns ExportInfo[]
export function extract_exports(
  node: SyntaxNode,
  source_code: string,
  language: Language
): ExportInfo[] {
  // Creates ExportInfo objects
}

// AFTER: Returns Export[] directly
export function extract_exports(
  node: SyntaxNode,
  source_code: string,
  language: Language
): Export[] {
  // Directly creates NamedExport, DefaultExport, etc.
  // Using createNamedExport() helper from unified-import-export-types
}
```

## Benefits

- Eliminates ~50 lines of adapter code
- Single source of truth for export types
- Better handling of re-exports with dedicated type
- Cleaner discriminated unions

## Affected Files

- `packages/core/src/import_export/export_detection.ts`
- `packages/core/src/import_export/export_detection.javascript.ts`
- `packages/core/src/import_export/export_detection.typescript.ts`
- `packages/core/src/import_export/export_detection.python.ts`
- `packages/core/src/import_export/export_detection.rust.ts`

## Testing Requirements

- Verify all export types correctly produced:
  - Named exports
  - Default exports
  - Namespace exports (export * as)
  - Re-exports (export { x } from 'module')
- Test all supported languages
- Ensure branded types properly used
- Test complex cases like renamed exports