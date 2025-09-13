---
id: task-epic-11.100.0.5.19.9.5
title: Update file_analyzer.ts to handle CallInfo type
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['refactoring', 'file-analysis', 'types']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: high
---

## Description

Update file_analyzer.ts to handle the new CallInfo type returned by find_method_calls instead of the previous MethodCall[] type.

## Current Issue

The file_analyzer.ts currently:
1. Imports find_method_calls which now returns CallInfo[]
2. Expects to return method_calls: MethodCall[] from analyze_calls_in_file()
3. Uses MethodCall type in function signatures

## Required Changes

### 1. Update Type Imports
```typescript
// Add CallInfo import
import { CallInfo } from "@ariadnejs/types";
```

### 2. Update analyze_calls_in_file Function
The function currently returns:
```typescript
{
  function_calls: FunctionCall[];
  method_calls: MethodCall[];
  constructor_calls: ConstructorCall[];
}
```

Need to:
- Filter CallInfo[] to extract only method calls
- Convert or narrow types appropriately
- Update return type documentation

### 3. Handle CallInfo Union Type

Since find_method_calls now returns CallInfo[], need to:

```typescript
const all_calls = find_method_calls(method_call_context);
const method_calls = all_calls.filter((call): call is MethodCall =>
  call.kind === 'method'
);
```

### 4. Update Function Signatures

Any functions that take method_calls parameters need to be updated to handle the type changes.

## Alternative Approaches

### Option 1: Filter at call site
Filter CallInfo[] to MethodCall[] where method calls are used.

### Option 2: Update downstream
Change downstream functions to accept CallInfo[] and handle filtering internally.

### Option 3: Hybrid approach
Return both CallInfo[] and filtered MethodCall[] for backward compatibility.

## Acceptance Criteria

- [ ] file_analyzer.ts compiles without errors
- [ ] Method calls are properly extracted from CallInfo[]
- [ ] No functionality is lost in the conversion
- [ ] Type safety is maintained
- [ ] Tests pass (if they exist for this module)