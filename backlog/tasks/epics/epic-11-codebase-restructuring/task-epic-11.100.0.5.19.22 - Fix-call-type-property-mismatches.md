---
id: task-epic-11.100.0.5.19.22
title: Fix call type property mismatches
status: To Do
assignee: []
created_date: "2025-01-13"
labels: ["type-system", "call-analysis"]
dependencies: ["task-epic-11.100.0.5.19.2"]
parent_task_id: task-epic-11.100.0.5.19.2
priority: high
---

## Description

Fix property name mismatches and missing properties in call types and CallChainNode that cause compilation errors after type refactoring.

## Issues to Fix

### 1. CallChainNode Property Mismatches

CallChainNode uses 'call' property but code references 'caller' and 'callee':

**Current errors:**
```
error TS2561: Object literal may only specify known properties, but 'caller' does not exist in type 'CallChainNode'. Did you mean to write 'call'?
error TS2551: Property 'caller' does not exist on type 'CallChainNode'. Did you mean 'call'?
error TS2551: Property 'callee' does not exist on type 'CallChainNode'. Did you mean 'call'?
```

### 2. MethodCall Missing receiver_type

MethodCall type is missing 'receiver_type' property:

**Current error:**
```
error TS2741: Property 'receiver_type' is missing in type '{ kind: "method"; ... }' but required in type 'MethodCall'.
```

### 3. Call Types Missing name properties

FunctionCall, MethodCall, and ConstructorCall missing legacy name properties:

**Current errors:**
```
error TS2339: Property 'caller_name' does not exist on type 'FunctionCall'.
error TS2339: Property 'callee_name' does not exist on type 'FunctionCall'.
error TS2339: Property 'caller_name' does not exist on type 'MethodCall'.
error TS2339: Property 'constructor_name' does not exist on type 'ConstructorCall'.
```

## Files to Update

### 1. Update CallChainNode Usage
File: `packages/core/src/call_graph/call_chain_analysis/call_chain_analysis.ts`

Replace 'caller'/'callee' with 'call' property:
```typescript
// Replace usages like:
node.caller → node.call
node.callee → node.call
{ caller: ... } → { call: ... }
```

### 2. Add receiver_type to MethodCall
File: `packages/types/src/calls.ts`

Add missing property:
```typescript
export interface MethodCall extends CallBase {
  readonly kind: 'method';
  readonly receiver: SymbolId;
  readonly receiver_type: TrackedType;  // ADD THIS
  readonly method_name: SymbolId;
}
```

### 3. Add Legacy Name Properties (Optional)
Consider adding backward compatibility properties or update code to use new property names.

## Acceptance Criteria

- [ ] CallChainNode property references use correct property names
- [ ] MethodCall includes receiver_type property
- [ ] All call type property errors resolved
- [ ] call_chain_analysis module compiles without property errors
- [ ] Test files updated to match new property structure

## Implementation Strategy

1. **Property Name Consistency**: Ensure CallChainNode API matches usage
2. **Type Completeness**: Add missing required properties to call types
3. **Legacy Support**: Decide whether to maintain backward compatibility or update all references
4. **Test Updates**: Update test fixtures to match new type structure