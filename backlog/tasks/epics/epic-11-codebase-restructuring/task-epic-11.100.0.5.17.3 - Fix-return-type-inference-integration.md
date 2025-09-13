---
id: task-epic-11.100.0.5.17.3
title: Fix return type inference integration with unified types
status: To Do
assignee: []
created_date: '2025-09-13'
labels: ['bug-fix', 'type-inference', 'return-types']
dependencies: ['task-epic-11.100.0.5.17.1']
parent_task_id: task-epic-11.100.0.5.17
priority: high
---

## Description

Fix return type inference showing "unknown" instead of proper inferred types when integrating with the unified type system after adapter removal.

## Background

Return type inference tests show functions with return_type: 'unknown' instead of properly inferred types. This suggests the return type inference is not properly integrated with the unified type system or the inference logic is not working correctly.

## Acceptance Criteria

- [ ] Return type inference produces actual types instead of "unknown"
- [ ] Async function return types are properly inferred
- [ ] Arrow function return types work correctly
- [ ] TypeScript explicit return types are preserved
- [ ] Python function return types are inferred
- [ ] Return type inference integrates with unified TypeInfo system

## Implementation Details

**Current Issues Observed:**
```
Functions found: [
  { name: 'anonymous_scope_1', return_type: 'unknown' },
  { name: 'anonymous_scope_2', return_type: 'unknown' }
]
```

**Root Cause Analysis:**
In file_analyzer.ts lines 385-410, return type integration:
```typescript
const return_type_info = inferred_returns.get(func_name);
// ...
return_type: (return_type_info?.type_name as TypeString) || 'unknown' as TypeString,
```

**Investigation Required:**
- Verify `infer_all_return_types()` is working correctly
- Check if return type analysis keys match function names
- Ensure return type inference works with unified TypeInfo structure
- Test return type inference across all supported languages

## Affected Files

- `packages/core/src/file_analyzer.ts` (lines 385-410)
- `packages/core/src/type_analysis/return_type_inference.ts`
- `packages/core/src/file_analyzer.return_inference.test.ts`

## Test Cases

```javascript
// Should infer "number" return type
function add(a, b) {
  return a + b;
}

// Should infer "Promise<string>" return type
async function fetchData() {
  return "data";
}

// Should preserve explicit return type
function process(): boolean {
  return true;
}

// Should infer "string" from arrow function
const getName = () => "John";
```