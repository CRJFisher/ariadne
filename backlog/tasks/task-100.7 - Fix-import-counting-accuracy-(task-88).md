---
id: task-100.7
title: Fix import counting accuracy (task-88)
status: To Do
assignee: []
created_date: '2025-08-04 12:05'
labels: []
dependencies:
  - task-88
parent_task_id: task-100
---

## Description

Import counting currently counts word occurrences instead of actual import statements. This inflates import counts and affects validation accuracy. Example: graph.ts shows 27 imports but only has 2 actual statements.

## Acceptance Criteria

- [x] Import count reflects actual import statements
- [x] ScopeGraph.getAllImports() returns correct data
- [x] File summary import counts are accurate

## Implementation Notes

The issue was in the validation script, not in the core functionality. The validation was using `getAllImports().length` which counts individual imported symbols, not import statements.

### Root Cause
- `getAllImports()` returns individual imported symbols (e.g., `import { a, b, c }` returns 3 items)
- `getImportStatementCount()` correctly counts unique import statements (returns 1 for above)
- Validation script was using the wrong method

### Fix Applied
Changed `validate-ariadne.ts` line 261 from:
```typescript
imports: scopeGraph.getAllImports().length
```
to:
```typescript
imports: scopeGraph.getImportStatementCount()
```

This ensures import counts in file summaries reflect actual import statements, not individual symbols.
