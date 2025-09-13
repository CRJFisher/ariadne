---
id: task-epic-11.100.0.5.19.13.1
title: Fix branded type mismatches in scope_tree module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-errors', 'branded-types', 'scope-analysis']
dependencies: ['task-epic-11.100.0.5.19.13']
parent_task_id: task-epic-11.100.0.5.19.13
priority: high
---

## Description

Fix 68 TS2345 compilation errors in scope_tree module where raw strings are being passed to functions expecting branded types (FilePath, SymbolId, ScopeId).

## Error Analysis

Most common pattern:
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'FilePath'.
error TS2345: Argument of type 'string' is not assignable to parameter of type 'SymbolId'.
error TS2345: Argument of type 'string' is not assignable to parameter of type 'ScopeId'.
```

## Files Affected

- `scope_tree.javascript.test.ts` - 20+ errors
- `scope_tree.python.ts` - 15+ errors
- `scope_tree.rust.ts` - 15+ errors
- `scope_tree.test.ts` - 15+ errors
- `scope_tree.typescript.ts` - 3+ errors

## Solution Strategy

1. **Import branded type creators**:
   ```typescript
   import { to_file_path, to_symbol_id, to_scope_id } from "@ariadnejs/types";
   ```

2. **Fix test files**: Cast string literals to proper branded types
3. **Fix implementation files**: Use proper type creators for dynamic values

## Example Fixes

```typescript
// BEFORE
find_symbol_in_scope_chain(tree, "scope_0", "variable_name");

// AFTER
find_symbol_in_scope_chain(tree, "scope_0" as ScopeId, "variable_name");

// BEFORE
build_scope_tree(node, code, "javascript", "/path/to/file.js");

// AFTER
build_scope_tree(node, code, "javascript", "/path/to/file.js" as FilePath);
```

## Acceptance Criteria

- [ ] All TS2345 errors in scope_tree module resolved
- [ ] Tests still pass after type fixes
- [ ] No new type errors introduced
- [ ] Proper branded type usage throughout module