---
id: task-epic-11.100.0.5.19.13.3
title: Fix type assignment issues in scope_tree module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-errors', 'type-signatures', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.13']
parent_task_id: task-epic-11.100.0.5.19.13
priority: high
---

## Description

Fix 36 TS2322 compilation errors in scope_tree module caused by incompatible type assignments, mainly handler signature mismatches and string-to-branded-type assignments.

## Error Analysis

Main issues:
1. **Handler signature mismatches** (15 errors) - `ScopeTree` vs `MutableScopeTree`, `ScopeNode` vs `MutableScopeNode`
2. **String to branded type assignments** (21 errors) - raw strings assigned to `SymbolId` properties

## Files Affected

- `scope_tree.javascript.ts` - 10+ errors
- `scope_tree.python.ts` - 10+ errors
- `scope_tree.rust.ts` - 10+ errors
- `scope_tree.ts` - 6+ errors

## Error Examples

```typescript
// Handler signature mismatch
pre_process_node: (node: SyntaxNode, tree: ScopeTree, context: GenericScopeContext) => boolean
// Should be:
pre_process_node: (node: SyntaxNode, tree: MutableScopeTree, context: GenericScopeContext) => boolean

// String assignment to SymbolId
symbol.name = node.text; // string assigned to SymbolId property
```

## Solution Strategy

1. **Fix handler signatures** in bespoke files:
   ```typescript
   // Update BespokeHandlers interface usage
   export function create_javascript_handlers(): BespokeHandlers {
     return {
       pre_process_node: (node: SyntaxNode, tree: MutableScopeTree, context) => {
         // Implementation using MutableScopeTree
       },
       // ...
     };
   }
   ```

2. **Fix string-to-SymbolId assignments**:
   ```typescript
   // BEFORE
   symbol.name = node.text;

   // AFTER
   symbol.name = node.text as SymbolId;
   // OR use proper symbol creator
   symbol.name = variable_symbol(node.text, context.file_path, location);
   ```

3. **Align type usage throughout module**:
   - Use `MutableScopeTree`/`MutableScopeNode` during construction
   - Convert to readonly types when returning final results

## Acceptance Criteria

- [ ] All TS2322 errors in scope_tree module resolved
- [ ] Handler signatures match BespokeHandlers interface
- [ ] String assignments to branded types use proper casting/creators
- [ ] Type usage is consistent between mutable and readonly versions
- [ ] Tests pass after type fixes