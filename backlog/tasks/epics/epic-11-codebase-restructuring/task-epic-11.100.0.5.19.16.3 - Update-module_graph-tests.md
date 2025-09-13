---
id: task-epic-11.100.0.5.19.16.3
title: Update module_graph tests for new function signatures
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['testing', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.16.1', 'task-epic-11.100.0.5.19.16.2']
parent_task_id: task-epic-11.100.0.5.19.16
priority: medium
---

## Description

The existing tests in `module_graph.test.ts` use the old Map-based function signature and old import/export types. They need to be updated to work with both function signatures.

## Current Issues

1. **Old Function Signature**: Tests use the Map-based `build_module_graph(files, options)` signature
2. **Old Type Structure**: Tests create objects with old import/export structure
3. **Missing New Function Tests**: No tests for the new simplified `build_module_graph(imports, exports, file_path)` signature

## Changes Required

### 1. Update Existing Tests
- Rename imports to use `build_module_graph_from_files` for the Map-based version
- Fix test data to use new Import/Export discriminated union types
- Update assertions to match new type structures

### 2. Add New Function Tests
- Create tests for the simplified `build_module_graph(imports, exports, file_path)` function
- Test all import type variants (named, default, namespace, side_effect)
- Test all export type variants (named, default, namespace, reexport)
- Test edge cases and error handling

### 3. Test Data Migration
Convert test data from old structure:
```typescript
// OLD
imports: [{
  import_statement: {
    name: 'funcB',
    is_namespace: false,
    is_default: false
  },
  // ...
}]
```

To new discriminated union structure:
```typescript
// NEW
imports: [{
  kind: 'named',
  source: 'module-b' as ModulePath,
  imports: [{
    name: 'funcB' as SymbolName,
    is_type_only: false
  }],
  is_type_only: false,
  is_dynamic: false,
  // ... other SemanticNode properties
}]
```

## Acceptance Criteria

- [ ] All existing tests pass with updated signatures
- [ ] New tests cover the simplified function signature
- [ ] Tests use new Import/Export discriminated union types
- [ ] Test coverage maintained or improved
- [ ] Both function variants are tested appropriately