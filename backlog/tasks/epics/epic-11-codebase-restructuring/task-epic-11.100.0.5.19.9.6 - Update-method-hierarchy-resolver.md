---
id: task-epic-11.100.0.5.19.9.6
title: Update method hierarchy resolver for CallInfo type
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['refactoring', 'inheritance', 'types']
dependencies: ['task-epic-11.100.0.5.19.9']
parent_task_id: task-epic-11.100.0.5.19.9
priority: medium
---

## Description

Update the method hierarchy resolver module to work with the new CallInfo type instead of MethodCallInfo.

## Affected Files

- `method_hierarchy_resolver.ts` - Main hierarchy logic
- `method_hierarchy_resolver.test.ts` - Tests

## Current Issue

The method hierarchy resolver currently:
- Imports MethodCallInfo type
- Works with MethodCallInfo objects in hierarchy resolution
- Has functions that expect MethodCallInfo parameters

## Required Changes

### 1. Update Type Imports
```typescript
// OLD
import { MethodCallInfo } from '@ariadnejs/types';

// NEW
import { CallInfo, MethodCall } from '@ariadnejs/types';
```

### 2. Update Function Signatures

Functions like `enrich_method_calls_with_hierarchy()` that work with method call arrays need to:
- Accept CallInfo[] instead of MethodCallInfo[]
- Filter for method calls internally: `calls.filter(c => c.kind === 'method')`
- Return appropriately typed results

### 3. Update Internal Logic

Any internal logic that accesses method call properties needs to:
- Use type guards to narrow CallInfo to MethodCall
- Access properties through the correct interface
- Handle the discriminated union properly

### 4. Export Updates

The module exports MethodCallWithHierarchy type and related interfaces that may need updates to work with the new type system.

## Acceptance Criteria

- [ ] All functions compile without type errors
- [ ] Hierarchy resolution still works correctly
- [ ] Tests updated to use new types
- [ ] No loss of functionality
- [ ] Proper type narrowing implemented
- [ ] Export interface updated if needed