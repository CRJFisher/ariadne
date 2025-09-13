---
id: task-epic-11.100.0.5.19.9.1
title: Fix method_calls test compilation errors
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['testing', 'call-graph']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: high
---

## Description

Fix compilation errors in method_calls test files after updating to use CallInfo type.

## Test Files Affected

- `index.test.ts` - Multiple errors accessing properties that don't exist on CallInfo
- `method_calls.test.ts` - Similar property access errors
- Other test files in the module

## Required Changes

### 1. Update Test Assertions

The tests are trying to access properties like `method_name`, `receiver_name`, etc. which don't exist directly on CallInfo. Need to:

1. Use type guards to narrow to MethodCall type
2. Access properties correctly based on the new type structure
3. Update assertions to match new type definitions

Example fix:
```typescript
// OLD
expect(calls[0].method_name).toBe('myMethod');

// NEW
const methodCall = calls[0] as MethodCall; // or use type guard
expect(methodCall.method).toBe('myMethod');
```

### 2. Update Import Statements

Import MethodCall type where needed for type assertions.

## Acceptance Criteria

- [ ] All test files compile without errors
- [ ] Tests still verify the same functionality
- [ ] Type guards used where appropriate
- [ ] No use of `any` type to bypass errors