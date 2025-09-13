---
id: task-epic-11.100.0.5.19.13.4
title: Fix miscellaneous compilation errors in scope_tree module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-errors', 'interface-design', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.13.1', 'task-epic-11.100.0.5.19.13.2', 'task-epic-11.100.0.5.19.13.3']
parent_task_id: task-epic-11.100.0.5.19.13
priority: medium
---

## Description

Fix remaining 14 compilation errors in scope_tree module including interface inheritance issues, readonly property violations, function signature mismatches, and type compatibility problems.

## Error Analysis

Remaining error types:
- **TS2459** (4 errors): Unreachable condition due to non-overlapping types
- **TS2554** (3 errors): Wrong number of function arguments
- **TS2740** (2 errors): Missing required properties in type
- **TS2540** (2 errors): Cannot assign to readonly property
- **TS2430** (1 error): Interface extension error
- **TS2367** (1 error): Unintentional comparison of non-overlapping types
- **TS2352** (1 error): Type conversion warning

## Files Affected

- `scope_tree.ts` - Interface and type logic errors
- `scope_tree.rust.ts` - Readonly property violations
- Various test files - Function signature mismatches

## Error Examples

```typescript
// TS2540: Cannot assign to readonly property
scope.metadata = { /* ... */ }; // metadata is readonly

// TS2430: Interface extension error
interface EnhancedScopeSymbol extends ScopeSymbol {
  is_exported?: boolean; // conflicts with required boolean in base
}

// TS2554: Expected 2 arguments, but got 3
variable_symbol(name, file_path, location); // Too many args

// TS2367: Unintentional comparison
symbol.kind === "local" // SymbolKind doesn't include "local"
```

## Solution Strategy

1. **Fix readonly violations**:
   ```typescript
   // Use proper mutable types during construction
   interface MutableScopeNode extends Omit<ScopeNode, 'metadata'> {
     metadata: { [key: string]: any }; // mutable
   }
   ```

2. **Fix interface inheritance**:
   ```typescript
   // Ensure property types are compatible
   interface EnhancedScopeSymbol extends ScopeSymbol {
     is_exported: boolean; // remove optional to match base
   }
   ```

3. **Fix function calls**:
   ```typescript
   // Check function signatures and adjust calls
   variable_symbol(name, file_path); // Remove extra location param
   ```

4. **Fix type comparisons**:
   ```typescript
   // Use correct enum values
   symbol.kind === "variable" // instead of "local"
   ```

## Acceptance Criteria

- [ ] All remaining compilation errors in scope_tree module resolved
- [ ] Interface inheritance is proper and compatible
- [ ] Readonly/mutable property usage is consistent
- [ ] Function calls match expected signatures
- [ ] Type comparisons use valid enum values
- [ ] All tests pass after fixes