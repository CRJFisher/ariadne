---
id: task-epic-11.100.12
title: Refactor module_graph module
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['module-analysis', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.16']
parent_task_id: task-epic-11.100
priority: medium
---

## Description

Refactor the module_graph module to use the new query-based system and discriminated union types.

## Using New Import/Export Types

The module graph now accepts the new discriminated union types:

```typescript
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
```

## Implementation Notes

The new `build_module_graph` function in `module_graph_builder.ts` now accepts:
- `imports: Import[]` - Array of discriminated union import types
- `exports: Export[]` - Array of discriminated union export types
- `file_path: string` - Path of the file being analyzed

The function body is currently stubbed out and ready for implementation using the new query-based approach.

## Acceptance Criteria

- [ ] Implement module graph building using new Import/Export types
- [ ] Support all import kinds (named, default, namespace, side_effect)
- [ ] Support all export kinds (named, default, namespace, reexport)
- [ ] Handle module resolution correctly
- [ ] Tests pass for all languages