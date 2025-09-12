---
id: task-epic-11.100.0.5.19.16
title: Update module_graph module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'module-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the module_graph module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/import_export/module_graph/module_graph_builder.ts`

```typescript
// OLD
export function build_module_graph(
  imports: ImportInfo[],
  exports: ExportInfo[],
  file_path: string
): ModuleGraph

// NEW
export function build_module_graph(
  imports: Import[],
  exports: Export[],
  file_path: string
): ModuleGraph
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function build_module_graph(
  imports: Import[],
  exports: Export[],
  file_path: string
): ModuleGraph {
  // TODO: Implement using new query-based system
  // See task 11.100.12 for implementation details
  return {
    nodes: new Map(),
    edges: [],
    entry_points: []
  };
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.12 - Refactor-module_graph.md`

Add section about using new types:
```markdown
## Using New Import/Export Types

The module graph now accepts the new discriminated union types:

\`\`\`typescript
// Process imports by kind
imports.forEach(imp => {
  switch(imp.kind) {
    case 'named':
      // Handle named imports
      break;
    case 'default':
      // Handle default imports
      break;
    case 'namespace':
      // Handle namespace imports
      break;
  }
});
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature uses new Import/Export types
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.12 documentation updated
- [ ] Module compiles without errors