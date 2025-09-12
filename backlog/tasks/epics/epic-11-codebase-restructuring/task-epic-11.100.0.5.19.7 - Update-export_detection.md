---
id: task-epic-11.100.0.5.19.7
title: Update export_detection module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'export-detection']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the export_detection module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/export_detection/export_extraction.ts`

```typescript
// OLD
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): UnifiedExport[]

// NEW
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Export[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Export[] {
  // TODO: Implement using new query-based system
  // See task 11.100.3 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.3 - Refactor-export_detection.md`

Add section about new type creation functions:
```markdown
## New Type Creation Functions

Use these functions from `import_export_types.ts` to create exports:

- `createNamedExport()` - For named exports
- `createDefaultExport()` - For default exports
- `createNamespaceExport()` - For namespace exports
- `createReExport()` - For re-exports
- `createAggregateExport()` - For aggregate exports

Example:
\`\`\`typescript
const namedExport = createNamedExport(
  [{ name: toSymbolName('foo'), alias: toSymbolName('bar') }],
  location,
  'javascript'
);
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature uses `Export[]` type
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.3 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors