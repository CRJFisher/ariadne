---
id: task-34
title: Implement get_calls_from_definition API
status: To Do
assignee: []
created_date: "2025-07-18"
labels: []
dependencies:
  - task-32
  - task-33
---

## Description

Implement the get_calls_from_definition API that returns all function/method calls made within a definition's body. This enables analysis of what a function calls.

## Acceptance Criteria

- [ ] API function get_calls_from_definition implemented
- [ ] Identifies function calls within definition body
- [ ] Identifies method calls within definition body
- [ ] Identifies constructor calls within definition body
- [ ] Resolves calls to their definitions when possible
- [ ] Handles nested and anonymous function calls
- [ ] Works with arrow functions and callbacks
- [ ] Works with async/await patterns
- [ ] Unit tests cover all call types
- [ ] Gracefully handles unresolved symbols

## API Specification

### Function Signature

```typescript
get_calls_from_definition(def: Definition): Call[]
```

### Return Type

Uses the `Call` interface defined in task-32:

```typescript
interface Call {
  symbol: string; // Symbol being called
  range: Range; // Location of the call
  kind: "function" | "method" | "constructor";
  resolved?: Definition; // The definition being called (if resolved)
}
```

### Use Cases

- Analyzing function complexity
- Building custom dependency graphs
- Finding specific call patterns
- Debugging call relationships
