---
id: task-epic-11.100.0.5.19.15
title: Update namespace_resolution module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'namespace-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the namespace_resolution module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/namespace_resolution/namespace_extraction.ts`

```typescript
// OLD
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): NamespaceInfo[]

// NEW
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_namespaces(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): Import[] {
  // TODO: Implement using new query-based system
  // See task 11.100.11 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.11 - Refactor-namespace_resolution.md`

Add section about namespace imports:
```markdown
## Namespace Import Creation

Use `createNamespaceImport()` from `import_export_types.ts`:

\`\`\`typescript
const namespaceImport = createNamespaceImport(
  toNamespaceName('MyNamespace'),
  buildModulePath('./module'),
  location,
  'javascript'
);
\`\`\`

Note: Namespaces are a variant of Import with `kind: 'namespace'`.
```

## Acceptance Criteria

- [ ] Function signature returns `Import[]` (namespace imports)
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.11 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors