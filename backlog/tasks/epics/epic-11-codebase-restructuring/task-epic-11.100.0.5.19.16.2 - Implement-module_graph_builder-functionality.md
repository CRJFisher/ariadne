---
id: task-epic-11.100.0.5.19.16.2
title: Implement functionality in module_graph_builder.ts
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['implementation', 'module-analysis']
dependencies: ['task-epic-11.100.0.5.19.16']
parent_task_id: task-epic-11.100.0.5.19.16
priority: medium
---

## Description

The new `module_graph_builder.ts` file contains only a stub implementation. It needs to be implemented using the new query-based system and discriminated union types.

## Current State

```typescript
export function build_module_graph(
  imports: Import[],
  exports: Export[],
  file_path: string
): ModuleGraph {
  // TODO: Implement using new query-based system
  // See task 11.100.12 for implementation details
  return {
    modules: new Map(),
    entry_points: new Set(),
    dependency_order: []
  };
}
```

## Implementation Requirements

1. **Process Import Types**: Handle all discriminated union variants:
   - `NamedImport` - import { foo, bar as baz } from 'module'
   - `DefaultImport` - import foo from 'module'
   - `NamespaceImport` - import * as foo from 'module'
   - `SideEffectImport` - import 'module'

2. **Process Export Types**: Handle all discriminated union variants:
   - `NamedExport` - export { foo, bar as baz }
   - `DefaultExport` - export default foo
   - `NamespaceExport` - export * from 'module'
   - `ReExport` - export { foo } from 'module'

3. **Build Module Nodes**: Create proper ModuleNode entries with:
   - Imported modules map
   - Exported symbols map
   - Dependencies tracking

4. **Module Resolution**: Resolve import paths to actual file paths

## Acceptance Criteria

- [ ] Function processes all Import discriminated union types
- [ ] Function processes all Export discriminated union types
- [ ] Returns proper ModuleGraph structure
- [ ] Module resolution works for relative/absolute paths
- [ ] Tests added for all import/export type combinations
- [ ] Integration with broader module analysis pipeline