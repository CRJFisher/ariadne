---
id: task-epic-11.100.4
title: Refactor function_calls to use query-based system
status: To Do
assignee: []
created_date: '2025-01-13'
labels: ['ast-processing', 'call-graph', 'query-system']
dependencies: ['task-epic-11.100.0.5.19.8']
parent_task_id: task-epic-11.100
priority: high
---

## Description

Refactor the function_calls module to use the new query-based system with proper type creation using the new CallInfo types.

## Implementation Details

### Query-Based Approach

The function_calls module should be refactored to use tree-sitter queries instead of imperative AST traversal. This aligns with the overall architecture direction of using declarative queries for AST analysis.

### New Type Creation

Use `create_function_call()` from `@ariadnejs/types/calls`:

```typescript
import {
  create_function_call,
  create_method_call,
  create_constructor_call,
  CallInfo,
  MODULE_CONTEXT,
  to_caller_name
} from '@ariadnejs/types';

// For function calls
const call = create_function_call(
  to_caller_name('parentFunction'), // or MODULE_CONTEXT for top-level
  symbol_id('myFunction'),
  location,
  'javascript',
  {
    arguments_count: 2,
    is_async: true,
    is_dynamic: false
  }
);

// For method calls
const methodCall = create_method_call(
  to_caller_name('parentFunction'),
  symbol_id('obj'),
  symbol_id('method'),
  location,
  'javascript',
  {
    arguments_count: 1,
    is_static: false,
    is_chained: true
  }
);

// For constructor calls
const constructorCall = create_constructor_call(
  MODULE_CONTEXT,
  to_class_name('MyClass'),
  location,
  'javascript',
  {
    arguments_count: 0,
    is_new_expression: true,
    assigned_to: symbol_id('instance')
  }
);
```

Note: Function calls are discriminated by `kind: 'function'` in the CallInfo union.

## Query Pattern Structure

Create query files for each language:

```
function_calls/
├── queries/
│   ├── javascript.scm
│   ├── typescript.scm
│   ├── python.scm
│   └── rust.scm
```

Example query pattern:
```scheme
; Function calls
(call_expression
  function: (identifier) @callee
  arguments: (arguments) @args) @call

; Method calls
(call_expression
  function: (member_expression
    object: (identifier) @receiver
    property: (property_identifier) @method)
  arguments: (arguments) @args) @call

; Constructor calls
(new_expression
  constructor: (identifier) @class_name
  arguments: (arguments) @args) @call
```

## Integration Points

- Use `scope_tree` from context to resolve local symbols
- Use `imports` from context to identify imported functions
- Use `type_map` from context to resolve method receiver types

## Acceptance Criteria

- [ ] Query files created for all supported languages
- [ ] Function returns `CallInfo[]` instead of `FunctionCallInfo[]`
- [ ] Proper type creation using factory functions
- [ ] All tests passing with new implementation
- [ ] Integration with scope_tree, imports, and type_map working