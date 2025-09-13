---
id: task-epic-11.100.0.5.19.20.4
title: Fix CallInfo property name migrations
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['type-migration', 'call-analysis', 'property-mapping']
dependencies: ['task-epic-11.100.0.5.19.20']
parent_task_id: task-epic-11.100.0.5.19.20
priority: high
---

## Description

Fix compilation errors in call_chain_analysis caused by using old property names from legacy CallInfo types instead of new unified CallInfo structure.

## Issues Found

### Old Property Names Still Used

Code is trying to access properties that don't exist in the new CallInfo types:

```
src/call_graph/call_chain_analysis/call_chain_analysis.ts(182,21): error TS2339: Property 'caller_name' does not exist on type 'FunctionCall'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(183,21): error TS2339: Property 'callee_name' does not exist on type 'FunctionCall'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(186,21): error TS2339: Property 'caller_name' does not exist on type 'MethodCall'.
src/call_graph/call_chain_analysis/call_chain_analysis.ts(191,21): error TS2339: Property 'constructor_name' does not exist on type 'ConstructorCall'.
```

## Property Mapping

### FunctionCall Property Changes

```typescript
// OLD (FunctionCallInfo)
caller_name -> caller
callee_name -> callee

// NEW (FunctionCall)
interface FunctionCall {
  caller: CallerContext;
  callee: SymbolId;
  // ...
}
```

### MethodCall Property Changes

```typescript
// OLD (MethodCallInfo)
caller_name -> caller
method_name -> method_name (unchanged)
receiver_name -> receiver

// NEW (MethodCall)
interface MethodCall {
  caller: CallerContext;
  method_name: SymbolId;
  receiver: SymbolId;
  // ...
}
```

### ConstructorCall Property Changes

```typescript
// OLD (ConstructorCallInfo)
constructor_name -> class_name

// NEW (ConstructorCall)
interface ConstructorCall {
  class_name: ClassName;
  // ...
}
```

## Changes Required

### 1. Update Property Access in Type Guards

Fix the type guard functions:

```typescript
// OLD
if (is_function_call_info(call)) {
  caller = call.caller_name;
  callee = call.callee_name;
} else if (is_method_call_info(call)) {
  caller = call.caller_name;
  callee = call.method_name;
} else if (is_constructor_call_info(call)) {
  caller = call.assigned_to || "<module>";
  callee = call.constructor_name;
}

// NEW
if (call.kind === 'function') {
  caller = call.caller;
  callee = call.callee;
} else if (call.kind === 'method') {
  caller = call.caller;
  callee = call.method_name;
} else if (call.kind === 'constructor') {
  caller = call.assigned_to || "<module>";
  callee = call.class_name;
}
```

### 2. Update Call Info Search

Fix the find_call_info function:

```typescript
// OLD
function find_call_info(caller: SymbolId, callee: SymbolId, calls: readonly CallInfo[]): any {
  for (const call of calls) {
    if ("caller_name" in call && call.caller_name === caller) {
      if ("callee_name" in call && call.callee_name === callee) {
        return call;
      }
      if ("method_name" in call && (call as any).method_name === callee) {
        return call;
      }
    }
    if ("constructor_name" in call && call.constructor_name === callee) {
      return call;
    }
  }
  return null;
}

// NEW
function find_call_info(caller: SymbolId, callee: SymbolId, calls: readonly CallInfo[]): CallInfo | null {
  for (const call of calls) {
    if (call.caller === caller) {
      switch (call.kind) {
        case 'function':
          if (call.callee === callee) return call;
          break;
        case 'method':
          if (call.method_name === callee) return call;
          break;
        case 'constructor':
          if (call.class_name === callee) return call;
          break;
      }
    }
  }
  return null;
}
```

### 3. Update Type Determination

Fix the determine_call_type function:

```typescript
// OLD
function determine_call_type(call_info: any): "function" | "method" | "constructor" {
  if (!call_info) return "function";

  if ("constructor_name" in call_info) return "constructor";
  if ("method_name" in call_info) return "method";
  if ("is_constructor_call" in call_info && call_info.is_constructor_call) return "constructor";
  if ("is_method_call" in call_info && call_info.is_method_call) return "method";
  return "function";
}

// NEW
function determine_call_type(call_info: CallInfo | null): "function" | "method" | "constructor" {
  if (!call_info) return "function";
  return call_info.kind;
}
```

## Files to Update

- `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`

## Acceptance Criteria

- [ ] All property access uses new CallInfo property names
- [ ] Type guards updated to use discriminated union pattern
- [ ] Call info search uses new property structure
- [ ] Type determination simplified to use 'kind' property
- [ ] Code compiles without property access errors
- [ ] Functionality preserved with new property names