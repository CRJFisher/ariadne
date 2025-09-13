---
id: task-epic-11.100.0.5.19.8.1
title: Fix call_chain_analysis compilation errors after function_calls refactor
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['compilation-fix', 'call-graph', 'types']
dependencies: ['task-epic-11.100.0.5.19.8']
parent_task_id: task-epic-11.100.0.5.19.8
priority: high
---

## Description

Fix compilation errors in `call_chain_analysis` module that resulted from updating function_calls to use CallInfo[] instead of FunctionCallInfo[].

## Compilation Errors Found

During testing of the function_calls refactor, the following compilation errors were discovered in `packages/core/src/call_graph/call_chain_analysis/`:

### Property Access Errors
```
error TS2339: Property 'caller_name' does not exist on type 'FunctionCall'.
error TS2339: Property 'callee_name' does not exist on type 'FunctionCall'.
error TS2339: Property 'constructor_name' does not exist on type 'ConstructorCall'.
```

### Type Structure Errors
```
error TS2561: Object literal may only specify known properties, but 'caller' does not exist in type 'CallChainNode'. Did you mean to write 'call'?
error TS2551: Property 'caller' does not exist on type 'CallChainNode'. Did you mean 'call'?
error TS2551: Property 'callee' does not exist on type 'CallChainNode'. Did you mean 'call'?
```

### Type System Mismatches
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'SymbolId'.
error TS2339: Property 'max_depth' does not exist on type 'CallChain'.
error TS2339: Property 'is_recursive' does not exist on type 'CallChain'.
```

## Required Changes

### 1. Update Property Access Patterns

Replace old property access:
```typescript
// OLD - accessing deprecated properties
call.caller_name
call.callee_name
call.constructor_name

// NEW - use CallInfo discriminated union
switch (call.kind) {
  case 'function':
    call.caller  // CallerContext
    call.callee  // SymbolId
    break;
  case 'method':
    call.caller  // CallerContext
    call.method_name  // SymbolId
    call.receiver  // SymbolId
    break;
  case 'constructor':
    call.caller  // CallerContext
    call.class_name  // ClassName
    break;
}
```

### 2. Update CallChainNode Structure

Ensure CallChainNode uses correct property names that match the current type definitions.

### 3. Fix SymbolId Type Usage

Convert string literals to SymbolId using factory functions:
```typescript
import { function_symbol, class_symbol, method_symbol } from '@ariadnejs/types';

// Instead of raw strings
const symbolId = function_symbol('functionName', filePath, location);
```

### 4. Update CallChain Interface

Verify CallChain interface includes expected properties like `max_depth`, `is_recursive`, etc.

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`
- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.test.ts`

## Acceptance Criteria

- [ ] All compilation errors in call_chain_analysis module resolved
- [ ] Property access updated to use new CallInfo discriminated union
- [ ] SymbolId types used correctly with factory functions
- [ ] Tests updated to match new data structures
- [ ] Module builds without errors

## Priority

High - This is blocking compilation of the core module and needs to be resolved before further development can proceed.