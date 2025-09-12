---
id: task-epic-11.100.0.5.14
title: Migrate import_resolution to Import
status: To Do
assignee: []
created_date: '2025-09-12'
labels: ['type-harmonization', 'refactoring']
dependencies: ['task-epic-11.100.0.5.4']
parent_task_id: task-epic-11.100.0.5
priority: high
---

## Description

Update the import_resolution module to directly produce Import types from AST traversal, eliminating the need for the ImportInfo → ImportStatement adapter.

## Background

Currently we have duplicate type definitions:
- `ImportInfo` (internal type used during extraction)
- `ImportStatement` (public API type)
- `convert_import_info_to_statement()` adapter function

This creates unnecessary complexity and maintenance burden.

## Acceptance Criteria

- [ ] import_resolution module returns `Import[]` instead of `ImportInfo[]`
- [ ] Module uses discriminated unions (NamedImport, DefaultImport, etc.)
- [ ] All branded types used (ModulePath, SymbolName, NamespaceName)
- [ ] No intermediate ImportInfo type needed
- [ ] Tests updated to verify Import output
- [ ] File size remains under 32KB limit

## Implementation Strategy

```typescript
// BEFORE: Returns ImportInfo[]
export function extract_imports(
  node: SyntaxNode,
  source_code: string,
  language: Language
): ImportInfo[] {
  // Creates ImportInfo objects
}

// AFTER: Returns Import[] directly
export function extract_imports(
  node: SyntaxNode,
  source_code: string,
  language: Language
): Import[] {
  // Directly creates NamedImport, DefaultImport, etc.
  // Using createNamedImport() helper from unified-import-export-types
}
```

## Benefits

- Eliminates ~50 lines of adapter code
- Single source of truth for import types
- Direct AST → API mapping
- Better type safety with discriminated unions

## Affected Files

- `packages/core/src/import_export/import_resolution.ts`
- `packages/core/src/import_export/import_resolution.javascript.ts`
- `packages/core/src/import_export/import_resolution.typescript.ts`
- `packages/core/src/import_export/import_resolution.python.ts`
- `packages/core/src/import_export/import_resolution.rust.ts`

## Testing Requirements

- Verify all import types correctly produced:
  - Named imports
  - Default imports
  - Namespace imports
  - Side-effect imports
- Test all supported languages
- Ensure branded types properly used