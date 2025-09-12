---
id: task-epic-11.100.0.5.19.6
title: Update import_resolution module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'import-resolution']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the import_resolution module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/import_resolution/import_extraction.ts`

```typescript
// OLD
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): UnifiedImport[]

// NEW
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_imports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[] {
  // TODO: Implement using new query-based system
  // See task 11.100.2 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.2 - Refactor-import_resolution.md`

Add section about new type creation functions:
```markdown
## New Type Creation Functions

Use these functions from `import_export_types.ts` to create imports:

- `createNamedImport()` - For named imports
- `createDefaultImport()` - For default imports  
- `createNamespaceImport()` - For namespace imports
- `createSideEffectImport()` - For side-effect imports
- `createDynamicImport()` - For dynamic imports

Example:
\`\`\`typescript
const namedImport = createNamedImport(
  [{ name: toSymbolName('foo'), alias: toSymbolName('bar') }],
  buildModulePath('./module'),
  location,
  'javascript'
);
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature uses `Import[]` type
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.2 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors