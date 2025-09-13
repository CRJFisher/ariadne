---
id: task-epic-11.100.0.5.19.8.2
title: Update function_calls tests for new CallInfo structure
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['testing', 'call-graph', 'types']
dependencies: ['task-epic-11.100.0.5.19.8', 'task-epic-11.100.4']
parent_task_id: task-epic-11.100.0.5.19.8
priority: medium
---

## Description

Update all function_calls module tests to work with the new CallInfo discriminated union structure instead of the deprecated FunctionCallInfo structure.

## Current State

The function_calls module has been updated to return `CallInfo[]` instead of `FunctionCallInfo[]`, but the tests still expect the old structure. Since the implementation functions now return empty arrays with TODO comments, the tests will need to be updated in coordination with the actual query-based implementation.

## Test Files to Update

### Core Test Files
- `packages/core/src/call_graph/function_calls/function_calls.test.ts`
- `packages/core/src/call_graph/function_calls/function_calls.typescript.test.ts`
- `packages/core/src/call_graph/function_calls/function_calls.rust.test.ts`
- `packages/core/src/call_graph/function_calls/function_calls.python.test.ts`

### Configuration Tests
- `packages/core/src/call_graph/function_calls/language_configs.test.ts`

## Required Changes

### 1. Update Expected Return Types

```typescript
// OLD - expecting FunctionCallInfo structure
expect(calls[0]).toEqual({
  caller_name: 'testFunction',
  callee_name: 'someFunction',
  location: { ... },
  is_method_call: false,
  is_constructor_call: false,
  arguments_count: 2
});

// NEW - expecting CallInfo discriminated union
expect(calls[0]).toEqual({
  kind: 'function',
  caller: 'testFunction' as CallerContext,
  callee: 'someFunction' as SymbolId,
  location: { ... },
  arguments_count: 2,
  is_async: false,
  is_dynamic: false,
  is_macro_call: false,
  is_in_comprehension: false,
  language: 'javascript',
  node_type: 'call_expression',
  modifiers: []
});
```

### 2. Update Test Patterns for Method Calls

```typescript
// NEW - method call structure
expect(methodCall).toEqual({
  kind: 'method',
  caller: 'testFunction' as CallerContext,
  receiver: 'obj' as SymbolId,
  method_name: 'method' as SymbolId,
  location: { ... },
  arguments_count: 1,
  is_static: false,
  is_chained: false,
  is_async: false,
  is_dynamic: false,
  receiver_type: {
    resolved: { type_name: 'unknown', type_kind: 'unknown' },
    confidence: 'low',
    reason: 'not_found'
  },
  language: 'javascript',
  node_type: 'member_expression',
  modifiers: []
});
```

### 3. Update Test Patterns for Constructor Calls

```typescript
// NEW - constructor call structure
expect(constructorCall).toEqual({
  kind: 'constructor',
  caller: MODULE_CONTEXT,
  class_name: 'MyClass' as ClassName,
  location: { ... },
  arguments_count: 0,
  is_new_expression: true,
  is_factory: false,
  is_async: false,
  is_dynamic: false,
  assigned_to: expect.stringMatching(/anonymous_\d+/) as SymbolId,
  language: 'javascript',
  node_type: 'new_expression',
  modifiers: []
});
```

### 4. Add Type Guard Tests

```typescript
import { is_function_call, is_method_call, is_constructor_call } from '@ariadnejs/types';

describe('CallInfo type guards', () => {
  it('should identify function calls correctly', () => {
    const calls = find_function_calls(context);
    const functionCalls = calls.filter(is_function_call);
    expect(functionCalls).toHaveLength(expectedFunctionCallCount);
  });

  it('should identify method calls correctly', () => {
    const calls = find_function_calls(context);
    const methodCalls = calls.filter(is_method_call);
    expect(methodCalls).toHaveLength(expectedMethodCallCount);
  });
});
```

### 5. Test Factory Function Usage

Once task 11.100.4 is implemented, tests should verify proper usage of factory functions:

```typescript
import { create_function_call, create_method_call, MODULE_CONTEXT } from '@ariadnejs/types';

// Test that implementation uses factory functions correctly
// This will be relevant after the query-based implementation is complete
```

## Implementation Strategy

### Phase 1: Minimal Updates (Current Priority)
- Update test expectations to match empty array returns from stubbed functions
- Ensure test structure is compatible with new CallInfo types
- Fix any compilation errors in test files

### Phase 2: Full Test Implementation (After task 11.100.4)
- Update tests to verify actual query-based implementation behavior
- Add comprehensive test coverage for all CallInfo discriminated union variants
- Test integration with scope_tree, imports, and type_map

## Dependencies

- **Blocks**: Full testing of function_calls module
- **Depends on**: task-epic-11.100.4 (Refactor function_calls to use query-based system)
- **Related**: Any other modules that consume function_calls output

## Acceptance Criteria

- [ ] All function_calls test files compile without errors
- [ ] Test expectations updated for new CallInfo structure
- [ ] Tests pass with current stubbed implementation (returning empty arrays)
- [ ] Test structure prepared for future query-based implementation
- [ ] Type guard usage tested where applicable
- [ ] Language-specific test files updated for new structure