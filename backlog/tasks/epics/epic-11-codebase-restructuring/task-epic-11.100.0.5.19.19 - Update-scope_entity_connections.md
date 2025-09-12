---
id: task-epic-11.100.0.5.19.19
title: Update scope_entity_connections module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the scope_entity_connections module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/scope_analysis/scope_entity_connections/entity_connection_builder.ts`

```typescript
// OLD
export function build_entity_connections(
  scope_tree: ScopeTree,
  symbols: SymbolInfo[],
  types: TypeInfo[]
): EntityConnections

// NEW
export function build_entity_connections(
  scope_tree: ScopeDefinition,
  symbols: SymbolDefinition[],
  types: Map<SymbolId, TrackedType>
): EntityConnections
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function build_entity_connections(
  scope_tree: ScopeDefinition,
  symbols: SymbolDefinition[],
  types: Map<SymbolId, TrackedType>
): EntityConnections {
  // TODO: Implement using new query-based system
  // See task 11.100.18 for implementation details
  return {
    scope_to_symbols: new Map(),
    symbol_to_type: new Map(),
    type_to_scope: new Map()
  };
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.18 - Refactor-scope_entity_connections.md`

Add section about using new types:
```markdown
## Using New Types for Connections

Build connections using the new type system:

\`\`\`typescript
// Connect scope to symbols
scope_to_symbols.set(
  scope.path,  // ScopePath
  symbols.filter(s => s.scope === scope.path)
);

// Connect symbols to types
symbol_to_type.set(
  symbol.id,  // SymbolId
  types.get(symbol.id)  // TrackedType
);
\`\`\`
```

## Acceptance Criteria

- [ ] Function signature uses new types
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.18 documentation updated
- [ ] Module compiles without errors