---
id: task-epic-11.100.0.5.19.9.4
title: Update bespoke language-specific method call functions
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['refactoring', 'call-graph', 'types']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: high
---

## Description

Update the bespoke language-specific method call functions to return CallInfo instead of MethodCallInfo to match the new type system.

## Affected Functions

### 1. Bespoke Detection Functions
All return `MethodCallInfo | null` but need to return `CallInfo | null`:

- `find_javascript_bespoke_method_calls()` in `method_calls.javascript.ts`
- `find_typescript_bespoke_method_calls()` in `method_calls.typescript.ts`
- `find_python_bespoke_method_calls()` in `method_calls.python.ts`
- `find_rust_bespoke_method_calls()` in `method_calls.rust.ts`

### 2. Enhancement Functions
All take and return `MethodCallInfo` but need to work with `CallInfo`:

- `enhance_typescript_method_call()`
- `enhance_python_method_call()`
- `enhance_rust_method_call()`

## Required Changes

### 1. Update Import Statements
```typescript
// OLD
import { MethodCallInfo } from '@ariadnejs/types';

// NEW
import { CallInfo } from '@ariadnejs/types';
```

### 2. Update Function Signatures
```typescript
// OLD
export function find_javascript_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): MethodCallInfo | null

// NEW
export function find_javascript_bespoke_method_calls(
  node: SyntaxNode,
  source: string
): CallInfo | null
```

### 3. Update Return Values
Use the new `createMethodCall()` function from `call_types.ts` to create properly typed CallInfo objects.

### 4. Update Enhancement Functions
Accept CallInfo, narrow to MethodCall type, and return CallInfo.

## Acceptance Criteria

- [ ] All bespoke functions return CallInfo | null
- [ ] All enhancement functions work with CallInfo
- [ ] No compilation errors in language-specific files
- [ ] Functions use new type creation utilities
- [ ] Proper type narrowing implemented where needed