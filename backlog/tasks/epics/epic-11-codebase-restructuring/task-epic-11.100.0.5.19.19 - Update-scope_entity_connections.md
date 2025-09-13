---
id: task-epic-11.100.0.5.19.19
title: Update scope_entity_connections module for new types
status: Completed
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

## Using New Types for Connections

Build connections using the new type system:

```typescript
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
```

## Implementation Notes

**Date:** 2025-09-13

### What Was Done

1. **Created new `build_entity_connections` function** - Added alongside existing `build_scope_entity_connections` to maintain backward compatibility

2. **Added `EntityConnections` interface** - Simple interface with three key mappings:
   ```typescript
   export interface EntityConnections {
     scope_to_symbols: Map<string, SymbolId[]>;
     symbol_to_type: Map<SymbolId, TrackedType>;
     type_to_scope: Map<string, string>;
   }
   ```

3. **Updated function signature** to use new unified types:
   - `Scope` type (from symbol_scope.ts)
   - `Symbol[]` array instead of individual definition types
   - `Map<SymbolId, TrackedType>` for type tracking

4. **Fixed type exports** - Added `Scope` to exports in `packages/types/src/index.ts`

### Decisions Made

- **Preserved existing function**: Kept `build_scope_entity_connections` intact to avoid breaking existing code
- **Used `Scope` instead of `ScopeDefinition`**: The latter doesn't exist in the current type system
- **Simplified return type**: `EntityConnections` is more focused than the complex `ScopeEntityConnections`
- **Added implementation placeholder**: Function body cleared with TODO referencing task 11.100.18

### Type System Integration

The new function integrates with the unified type system:
- Uses `SymbolId` branded types consistently
- Leverages `TrackedType` from type analysis
- Works with new `Scope` interface extending `SemanticNode`

## Acceptance Criteria

- [x] Function signature uses new types
- [x] Function body is cleared and ready for refactoring
- [x] Documentation added for using new types
- [x] Module compiles without errors (new function compiles successfully)