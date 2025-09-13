---
id: task-epic-11.100.0.5.19.13.2
title: Fix missing properties in scope_tree types
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-errors', 'type-definitions', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.13']
parent_task_id: task-epic-11.100.0.5.19.13
priority: high
---

## Description

Fix 36 TS2339 compilation errors in scope_tree module caused by missing properties and incorrect ReadonlyMap usage.

## Error Analysis

Main issues:
1. **Missing `metadata` property** on `ScopeSymbol` and `EnhancedScopeSymbol` types (25 errors)
2. **ReadonlyMap vs Map confusion** - trying to call `set`/`delete` on ReadonlyMap (11 errors)

## Files Affected

- `enhanced_symbols.ts` - 5 metadata errors
- `scope_tree.javascript.ts` - 15+ errors (metadata + ReadonlyMap)
- `scope_tree.python.ts` - 8+ errors (metadata + ReadonlyMap)
- `scope_tree.rust.ts` - 8+ errors (metadata + ReadonlyMap)

## Error Examples

```typescript
// TS2339: Property 'metadata' does not exist on type 'ScopeSymbol'
symbol.metadata.is_hoisted = true;

// TS2339: Property 'set' does not exist on type 'ReadonlyMap'
scope.symbols.set(symbolId, symbol);
```

## Solution Strategy

1. **Add metadata property to ScopeSymbol**:
   ```typescript
   export interface ScopeSymbol {
     // ... existing properties
     readonly metadata?: {
       readonly is_hoisted?: boolean;
       readonly declaration_type?: string;
       readonly is_class_scope?: boolean;
       readonly [key: string]: any;
     };
   }
   ```

2. **Use mutable Map in implementation**:
   ```typescript
   // Instead of ReadonlyMap<SymbolId, ScopeSymbol>
   // Use Map<SymbolId, ScopeSymbol> during construction
   ```

3. **Update EnhancedScopeSymbol interface**:
   ```typescript
   export interface EnhancedScopeSymbol extends ScopeSymbol {
     metadata: {
       declaration_type?: "const" | "let" | "var";
       is_exported?: boolean;
       is_hoisted?: boolean;
       [key: string]: any;
     };
   }
   ```

## Acceptance Criteria

- [ ] All TS2339 errors in scope_tree module resolved
- [ ] ScopeSymbol type includes optional metadata property
- [ ] EnhancedScopeSymbol properly extends ScopeSymbol with metadata
- [ ] ReadonlyMap/Map usage is consistent with mutability needs
- [ ] Tests pass after property additions