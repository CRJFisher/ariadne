---
id: task-epic-11.100.0.5.19.10.2
title: Add missing required properties in constructor_calls module
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['bug-fix', 'type-migration']
dependencies: ['task-epic-11.100.0.5.19.10.1']
parent_task_id: task-epic-11.100.0.5.19.10
priority: high
---

## Description

Add missing required properties to constructor call objects to match the new ConstructorCall interface.

## Missing Properties

The new `ConstructorCall` interface requires several properties that may be missing from legacy code:

### Required Properties

1. **assigned_to: SymbolId** - Variable/symbol receiving the constructor result
2. **caller: CallerContext** - Function making the constructor call (from BaseCallInfo)
3. **arguments_count: number** - Number of arguments passed (from BaseCallInfo)
4. **is_async: boolean** - Whether the call is async (from BaseCallInfo)
5. **is_dynamic: boolean** - Whether runtime-resolved (from BaseCallInfo)
6. **language: Language** - Programming language (from SemanticNode)
7. **node_type: string** - AST node type (from SemanticNode)
8. **modifiers: readonly string[]** - Node modifiers (from SemanticNode)

### Properties with Defaults

Some properties have default values in the helper functions:
- `is_new_expression`: defaults based on language
- `is_factory`: defaults to false
- `assigned_to`: defaults to anonymous symbol
- `modifiers`: defaults to empty array

## Implementation Strategy

### Use Helper Functions

Prefer using the `create_constructor_call()` helper from `@ariadnejs/types`:

```typescript
import { create_constructor_call, to_caller_context, to_class_name } from '@ariadnejs/types';

const call = create_constructor_call(
  to_caller_context(caller_name),
  to_class_name(class_name),
  location,
  language,
  {
    arguments_count: args.length,
    is_new_expression: node.type === 'new_expression',
    is_factory: is_factory_pattern,
    assigned_to: assigned_variable || `anonymous_${Date.now()}` as SymbolId
  }
);
```

### Manual Object Creation (if needed)

```typescript
const constructorCall: ConstructorCall = {
  kind: "constructor",
  caller: to_caller_context(caller_name),
  class_name: to_class_name(class_name),
  location,
  language,
  node_type: node.type,
  arguments_count: args.length,
  is_new_expression: language === 'javascript' || language === 'typescript',
  is_factory: false,
  is_async: false,
  is_dynamic: false,
  assigned_to: `anonymous_${Date.now()}` as SymbolId,
  modifiers: []
};
```

## Files to Update

All constructor_calls implementation and test files that create ConstructorCall objects:

- `constructor_calls.ts`
- `constructor_calls.javascript.ts`
- `constructor_calls.typescript.ts`
- `constructor_calls.python.ts`
- `constructor_calls.rust.ts`
- `constructor_type_extraction.ts`
- All test files

## Acceptance Criteria

- [ ] All ConstructorCall objects have required properties
- [ ] Helper functions used where possible
- [ ] Default values applied consistently
- [ ] TypeScript compilation succeeds
- [ ] All constructor_calls tests passing

## Validation

```bash
# Should compile without missing property errors
npx tsc --noEmit

# Should pass all tests
npm test -- constructor_calls
```