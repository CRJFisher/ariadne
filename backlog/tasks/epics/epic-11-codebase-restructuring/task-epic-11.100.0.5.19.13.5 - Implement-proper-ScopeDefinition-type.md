---
id: task-epic-11.100.0.5.19.13.5
title: Implement proper ScopeDefinition type for scope_tree
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['type-design', 'scope-analysis', 'architecture']
dependencies: ['task-epic-11.100.0.5.19.13.1', 'task-epic-11.100.0.5.19.13.2', 'task-epic-11.100.0.5.19.13.3', 'task-epic-11.100.0.5.19.13.4']
parent_task_id: task-epic-11.100.0.5.19.13
priority: medium
---

## Description

Replace the temporary `ScopeDefinition` type alias with a proper implementation based on the unified `Scope` type from `symbol_scope.ts`, once all compilation errors are resolved.

## Background

The current implementation uses a temporary alias:
```typescript
// Temporary workaround
export type ScopeDefinition = ScopeNode;
```

This should be replaced with the proper `Scope` type from the unified type system.

## Goal

Integrate the scope_tree module with the new unified symbol/scope type system described in `symbol_scope.ts`.

## Implementation Plan

1. **Enable symbol_scope exports**:
   ```typescript
   // In packages/types/src/index.ts
   export * from "./symbol_scope"; // Uncomment this line
   ```

2. **Update scope_tree to use unified types**:
   ```typescript
   import { Scope, Symbol, ScopePath } from "@ariadnejs/types";

   export type ScopeDefinition = Scope;

   export function createGlobalScope(file_path: FilePath): ScopeDefinition {
     return {
       path: to_scope_path("global"),
       type: "global",
       // ... implement using unified Scope interface
     };
   }
   ```

3. **Implement scope creation helpers**:
   ```typescript
   export function createModuleScope(name: string, parent: ScopeDefinition): ScopeDefinition;
   export function createClassScope(name: string, parent: ScopeDefinition): ScopeDefinition;
   export function createFunctionScope(name: string, parent: ScopeDefinition): ScopeDefinition;
   export function createBlockScope(parent: ScopeDefinition): ScopeDefinition;
   ```

4. **Update build_scope_tree implementation**:
   - Use query-based pattern as outlined in task 11.100.9
   - Return proper unified `Scope` instances
   - Integrate with symbol resolution system

## Dependencies

This task should only be started after:
- [ ] All compilation errors are fixed (tasks 13.1-13.4)
- [ ] Type exports are properly resolved in packages/types
- [ ] Query-based patterns are defined (task 11.100.9)

## Acceptance Criteria

- [ ] ScopeDefinition uses proper unified Scope type
- [ ] Scope creation helpers are implemented
- [ ] Integration with unified symbol system is complete
- [ ] All tests pass with new type system
- [ ] Documentation reflects unified type usage