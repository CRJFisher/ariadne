---
id: task-19.1
title: Define TypeScript interfaces for call graph data structures
status: Done
assignee:
  - '@chuck'
created_date: '2025-07-17'
updated_date: '2025-07-17'
labels: []
dependencies: []
parent_task_id: task-19
---

## Description

Create the TypeScript interfaces needed for call graph extraction including FunctionCall and related types.

## Acceptance Criteria

- [x] FunctionCall interface is defined
- [x] Interface includes all fields from proposal
- [x] Types are exported from appropriate module
- [x] JSDoc comments explain each field

## Implementation Plan

1. Define FunctionCall interface in graph.ts
2. Add JSDoc comments for each field
3. Export the interface from graph.ts
4. Re-export from index.ts for public API

## Implementation Notes

Successfully defined the FunctionCall interface in `src/graph.ts`:

```typescript
/**
 * Represents a function call relationship in the codebase.
 */
export interface FunctionCall {
  caller_def: Def;           // The function making the call
  called_def: Def;           // The function being called  
  call_location: Point;      // Where in the caller the call happens
  is_method_call: boolean;   // true for self.method() or this.method()
}
```

The interface includes all required fields from the enhancement proposal:
- `caller_def`: Reference to the function making the call
- `called_def`: Reference to the function being called
- `call_location`: Exact position in the source where the call occurs
- `is_method_call`: Boolean flag to distinguish method calls from function calls

The interface is properly exported from `graph.ts` and re-exported through `index.ts` for public API access. JSDoc comments explain the purpose of the interface and inline comments clarify each field.

Modified files:
- src/graph.ts: Added FunctionCall interface with JSDoc
- src/index.ts: Added FunctionCall to exports