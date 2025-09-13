---
id: task-epic-11.100.0.5.19.16.5
title: Resolve function naming conflicts and API consistency
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['api-design', 'refactoring']
dependencies: ['task-epic-11.100.0.5.19.16.1', 'task-epic-11.100.0.5.19.16.2', 'task-epic-11.100.0.5.19.16.4']
parent_task_id: task-epic-11.100.0.5.19.16
priority: medium
---

## Description

Currently there are two functions named `build_module_graph` with different signatures, which creates confusion and potential import conflicts. The API needs to be clarified and made consistent.

## Current State

### Function 1: Complex Map-based (module_graph.ts)
```typescript
export function build_module_graph(
  files: Map<FilePath, {file_path, language, imports, exports}>,
  options: ModuleGraphOptions = {}
): ModuleGraphWithEdges
```
- Currently exported as `build_module_graph_from_files` in index.ts
- Used by code_graph.ts and other downstream consumers

### Function 2: Simple array-based (module_graph_builder.ts)
```typescript
export function build_module_graph(
  imports: Import[],
  exports: Export[],
  file_path: string
): ModuleGraph
```
- Currently exported as `build_module_graph` in index.ts
- New function with stub implementation

## Issues

1. **Naming Confusion**: Same function name with different signatures
2. **Return Type Mismatch**: One returns `ModuleGraph`, other returns `ModuleGraphWithEdges`
3. **API Inconsistency**: Unclear which function to use when
4. **Import Conflicts**: Potential issues when both are imported

## Proposed Resolution

### Option 1: Clear Functional Separation
```typescript
// For single-file analysis
export function build_single_file_module_graph(
  imports: Import[],
  exports: Export[],
  file_path: string
): ModuleGraph

// For multi-file project analysis
export function build_project_module_graph(
  files: Map<FilePath, FileAnalysis>,
  options: ModuleGraphOptions
): ModuleGraphWithEdges
```

### Option 2: Unified Interface
- Deprecate one approach and migrate all usage to the other
- Choose the approach that best fits the new type system

## Implementation Steps

1. **Analyze Usage Patterns**: Determine which approach is more appropriate for the new architecture
2. **Choose Naming Convention**: Select clear, descriptive names
3. **Update Exports**: Update index.ts with final naming
4. **Update Documentation**: Clear usage guidelines
5. **Migration Guide**: Document changes for consumers

## Acceptance Criteria

- [ ] Clear, unambiguous function names
- [ ] Consistent return types and signatures
- [ ] Updated exports in index.ts
- [ ] Documentation explaining when to use each function
- [ ] All downstream code updated to use correct functions