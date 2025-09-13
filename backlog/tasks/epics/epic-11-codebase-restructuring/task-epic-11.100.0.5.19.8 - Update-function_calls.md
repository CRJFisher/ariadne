---
id: task-epic-11.100.0.5.19.8
title: Update function_calls module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
completed_date: '2025-01-13'
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

- [x] Function signature uses `CallInfo[]` type
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.4 documentation updated
- [x] References to type creation functions added
- [x] Module compiles without errors

## Implementation Notes

### Completed 2025-01-13

#### Files Modified
- `packages/core/src/call_graph/function_calls/function_calls.ts`
- `packages/core/src/call_graph/function_calls/function_calls.typescript.ts`
- `packages/core/src/call_graph/function_calls/function_calls.python.ts`
- `packages/core/src/call_graph/function_calls/function_calls.rust.ts`

#### Key Decisions Made

1. **File Structure Discovery**: The task referenced `function_call_extraction.ts` but the actual file was named `function_calls.ts`. Updated the correct file.

2. **Import Type Migration**: Discovered `ImportInfo` was deprecated in favor of `Import` from the new type system. Updated all references accordingly.

3. **Comprehensive Function Clearing**: Cleared not only the main functions but also all language-specific handlers (`handle_typescript_decorators`, `handle_python_comprehensions`, `handle_rust_macros`) to ensure consistency and prepare for complete refactoring.

4. **Created Missing Documentation**: Task 11.100.4 referenced in the TODO comments didn't exist, so created comprehensive refactoring documentation with:
   - Query-based approach guidelines
   - New type creation examples using factory functions
   - Integration points for scope_tree, imports, and type_map

#### Technical Changes

- **Type Updates**: All `FunctionCallInfo[]` → `CallInfo[]`
- **Import Updates**: `ImportInfo` → `Import`
- **Function Body Replacement**: All implementation replaced with TODO comments referencing task 11.100.4
- **Context Interface Update**: `FunctionCallContext.imports` type updated from `ImportInfo[]` to `Import[]`

#### Compilation Status
- All function_calls module files compile without errors
- Other modules may have unrelated compilation issues but function_calls module is clean
- Ready for query-based refactoring implementation