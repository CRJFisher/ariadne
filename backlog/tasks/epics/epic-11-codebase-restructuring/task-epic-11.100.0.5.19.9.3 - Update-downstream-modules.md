---
id: task-epic-11.100.0.5.19.9.3
title: Update modules that depend on method_calls
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['refactoring', 'call-graph']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: medium
---

## Description

Update downstream modules that import and use the method_calls module to handle the new CallInfo type.

## Modules to Check

### 1. file_analyzer.ts
- Currently imports and uses find_method_calls
- May need to update how it processes the results

### 2. call_chain_analysis
- May use method call information
- Check for type compatibility

### 3. Other call graph modules
- constructor_calls
- function_calls (if they share interfaces)

## Required Changes

### 1. Update Import Statements
```typescript
// If importing MethodCallInfo type
import { CallInfo } from "@ariadnejs/types";
```

### 2. Update Type Handling
- Use type guards to narrow CallInfo to MethodCall when needed
- Update any functions that expect MethodCallInfo[]

### 3. Update Processing Logic
- Handle the discriminated union properly
- Filter for method calls when needed: `calls.filter(c => c.kind === 'method')`

## Acceptance Criteria

- [ ] All downstream modules compile
- [ ] No runtime errors from type mismatches
- [ ] Proper type guards used where needed
- [ ] Documentation updated if APIs changed