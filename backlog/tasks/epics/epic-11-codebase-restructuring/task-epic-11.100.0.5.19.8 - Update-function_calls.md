---
id: task-epic-11.100.0.5.19.8
title: Update function_calls module for new types
status: To Do
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'call-graph']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the function_calls module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature
File: `packages/core/src/call_graph/function_calls/function_call_extraction.ts`

```typescript
// OLD
export function extract_function_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): FunctionCallInfo[]

// NEW
export function extract_function_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): CallInfo[]
```

### 2. Clear Function Body
Replace implementation with:
```typescript
export function extract_function_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): CallInfo[] {
  // TODO: Implement using new query-based system
  // See task 11.100.4 for implementation details
  return [];
}
```

### 3. Update Task Documentation
Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.4 - Refactor-function_calls.md`

Add section about new type creation:
```markdown
## New Type Creation

Use `createFunctionCall()` from `call_types.ts`:

\`\`\`typescript
const call = createFunctionCall({
  callee: toCalleeName('myFunction'),
  caller_context: toCallerContext('parentFunction'),
  arguments: args.map(toArgumentValue),
  location,
  language: 'javascript'
});
\`\`\`

Note: Function calls are discriminated by `kind: 'function'` in the CallInfo union.
```

## Acceptance Criteria

- [ ] Function signature uses `CallInfo[]` type
- [ ] Function body is cleared and ready for refactoring
- [ ] Task 11.100.4 documentation updated
- [ ] References to type creation functions added
- [ ] Module compiles without errors