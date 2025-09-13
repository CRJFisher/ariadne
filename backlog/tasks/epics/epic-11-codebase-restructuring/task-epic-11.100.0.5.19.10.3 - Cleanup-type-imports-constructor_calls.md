---
id: task-epic-11.100.0.5.19.10.3
title: Cleanup type imports in constructor_calls module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['cleanup', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.10.2']
parent_task_id: task-epic-11.100.0.5.19.10
priority: medium
---

## Description

Clean up type imports in constructor_calls module to use new unified CallInfo types instead of legacy ConstructorCallInfo.

## Current Issues

Many files still import and use the legacy `ConstructorCallInfo` type:

```typescript
// OLD - Legacy type alias
import { ConstructorCallInfo } from '@ariadnejs/types';
```

The `ConstructorCallInfo` is just a type alias for `ConstructorCall`, but for consistency and clarity, files should use the primary types directly.

## Required Changes

### 1. Update Import Statements

```typescript
// OLD
import { ConstructorCallInfo } from '@ariadnejs/types';

// NEW - Import the specific types needed
import { CallInfo, ConstructorCall } from '@ariadnejs/types';
// OR if using the discriminated union
import { CallInfo } from '@ariadnejs/types';
```

### 2. Update Type Annotations

```typescript
// OLD
function processConstructor(call: ConstructorCallInfo): void

// NEW
function processConstructor(call: ConstructorCall): void
// OR for arrays
function processConstructors(calls: CallInfo[]): void
```

### 3. Update Helper Imports

Add imports for new helper functions:

```typescript
import {
  CallInfo,
  ConstructorCall,
  create_constructor_call,
  is_constructor_call
} from '@ariadnejs/types';
```

## Files Affected

Based on grep analysis, these files import ConstructorCallInfo:

- `constructor_calls.javascript.ts`
- `constructor_calls.typescript.ts`
- `constructor_calls.python.ts`
- `constructor_calls.rust.ts`
- `constructor_type_extraction.ts`
- `constructor_type_resolver.ts`
- All test files (.test.ts)

## Implementation Notes

### Type Guards

Use the new type guard functions:

```typescript
import { is_constructor_call } from '@ariadnejs/types';

if (is_constructor_call(call)) {
  // call is now typed as ConstructorCall
  console.log(call.class_name);
}
```

### Working with CallInfo Arrays

When functions return `CallInfo[]`, filter for constructor calls:

```typescript
const calls: CallInfo[] = find_constructor_calls(context);
const constructorCalls = calls.filter(is_constructor_call);
```

## Acceptance Criteria

- [ ] No more imports of `ConstructorCallInfo`
- [ ] All type annotations use primary types (`CallInfo`, `ConstructorCall`)
- [ ] New helper functions imported where used
- [ ] Type guards used for type narrowing
- [ ] All files compile without type errors
- [ ] All tests still pass

## Validation

```bash
# Should return no results
grep -r "ConstructorCallInfo" packages/core/src/call_graph/constructor_calls/

# Should compile cleanly
npx tsc --noEmit

# Should pass tests
npm test -- constructor_calls
```

## Dependencies

This task should be done after:
1. Property name migration (task-epic-11.100.0.5.19.10.1)
2. Missing properties added (task-epic-11.100.0.5.19.10.2)

This ensures the objects are structurally correct before cleaning up the type references.