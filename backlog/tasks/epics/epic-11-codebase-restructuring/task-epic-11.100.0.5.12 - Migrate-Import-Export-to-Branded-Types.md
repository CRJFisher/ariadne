---
id: task-epic-11.100.0.5.12
title: Migrate Import Export to Branded Types
status: To Do
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

- [ ] All `source: string` replaced with `source: ModulePath`
- [ ] All `name: string` replaced with `name: SymbolName`
- [ ] All `alias?: string` replaced with `alias?: ImportName`
- [ ] All `namespace_name?: string` replaced with `namespace_name?: NamespaceName`
- [ ] Type guards implemented for all branded types
- [ ] Full test coverage for type conversions

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