---
id: task-epic-11.100.0.5.19.9
title: Update method_calls module for new types
status: Completed
assignee: []
created_date: '2025-01-12'
labels: ['ast-processing', 'call-graph']
dependencies: ['task-epic-11.100.0.5.19.3']
parent_task_id: task-epic-11.100.0.5.19
priority: medium
---

## Description

Update the method_calls module to use new type signatures and prepare for refactoring.

## Changes Required

### 1. Update Function Signature ✅ COMPLETED
~~File: `packages/core/src/call_graph/method_calls/method_call_extraction.ts`~~
**Actual files updated:**
- `packages/core/src/call_graph/method_calls/method_calls.ts` - `find_method_calls_generic()` function
- `packages/core/src/call_graph/method_calls/index.ts` - `find_method_calls()` function

```typescript
// OLD
export function extract_method_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): MethodCallInfo[]

// NEW
export function extract_method_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): CallInfo[]
```

### 2. Clear Function Body ✅ COMPLETED
Replace implementation with:
```typescript
export function extract_method_calls(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path: string
): CallInfo[] {
  // TODO: Implement using new query-based system
  // See task 11.100.5 for implementation details
  return [];
}
```

### 3. Update Task Documentation ✅ COMPLETED
~~Update file: `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.5 - Refactor-method_calls.md`~~
**Actual file updated:** `task-epic-11.100.6-transform-method-calls.md` (correct task for method_calls module)

Add section about new type creation:
```markdown
## New Type Creation

Use `createMethodCall()` from `call_types.ts`:

\`\`\`typescript
const call = createMethodCall({
  receiver: toReceiverName('myObject'),
  method: toCalleeName('myMethod'),
  caller_context: toCallerContext('parentFunction'),
  arguments: args.map(toArgumentValue),
  location,
  language: 'javascript'
});
\`\`\`

Note: Method calls are discriminated by `kind: 'method'` in the CallInfo union.
```

## Acceptance Criteria

- [x] Function signature uses `CallInfo[]` type
- [x] Function body is cleared and ready for refactoring
- [x] Task 11.100.6 documentation updated (corrected task reference)
- [x] References to type creation functions added
- [x] Module compiles without errors (main files; test files have expected compilation errors)

## Implementation Notes

### Completed - 2025-01-13

**Files Modified:**
1. `packages/core/src/call_graph/method_calls/method_calls.ts`
   - Updated `find_method_calls_generic()` return type from `MethodCallInfo[]` to `CallInfo[]`
   - Updated import from `MethodCallInfo` to `CallInfo`
   - Cleared function body, added TODO comment pointing to Task 11.100.6

2. `packages/core/src/call_graph/method_calls/index.ts`
   - Updated `find_method_calls()` return type from `MethodCallInfo[]` to `CallInfo[]`
   - Updated imports and re-exports to use `CallInfo`
   - Cleared function body, added TODO comment pointing to Task 11.100.6

3. `backlog/tasks/epics/epic-11-codebase-restructuring/task-epic-11.100.6-transform-method-calls.md`
   - Added "New Type Creation" section with `createMethodCall()` usage examples
   - Added note about `kind: 'method'` discriminator

**Implementation Decisions:**
- **Task Reference Correction**: The task mentioned Task 11.100.5, but the correct task for method_calls is 11.100.6 (11.100.5 is for function_calls)
- **File Name Correction**: The task mentioned `method_call_extraction.ts` which doesn't exist. Updated the actual files: `method_calls.ts` and `index.ts`
- **Function Name**: Updated `find_method_calls_generic()` and `find_method_calls()` rather than a non-existent `extract_method_calls()` function
- **Compilation Strategy**: Main module files compile cleanly; test file errors are expected and addressed in follow-up tasks

**Follow-up Tasks Created:**

*Based on comprehensive analysis of refactoring and testing results:*

**Critical Path (High Priority):**
- `task-epic-11.100.0.5.19.9.1` - Fix method_calls test compilation errors
- `task-epic-11.100.0.5.19.9.4` - Update bespoke language-specific functions (MethodCallInfo → CallInfo)
- `task-epic-11.100.0.5.19.9.5` - Update file_analyzer.ts type handling

**Integration Updates (Medium Priority):**
- `task-epic-11.100.0.5.19.9.6` - Update method hierarchy resolver
- `task-epic-11.100.0.5.19.9.8` - Update call chain analysis integration

**Optional/Investigative (Low Priority):**
- `task-epic-11.100.0.5.19.9.2` - Update method_calls tests for new implementation
- `task-epic-11.100.0.5.19.9.3` - Update downstream modules
- `task-epic-11.100.0.5.19.9.7` - Update scope analysis integration

**Coordination:**
- `task-epic-11.100.0.5.19.9.9` - Coordinate complete type system migration

**Status:** ✅ **COMPLETED** - Module ready for Task 11.100.6 implementation phase