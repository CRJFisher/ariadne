---
id: task-epic-11.173
title: Track calls from anonymous function bodies
status: To Do
assignee: []
created_date: '2026-01-20'
labels:
  - bug
  - call-graph
  - epic-11
dependencies: []
---

## Description

Method and function calls made from within anonymous arrow function bodies are not being tracked as call graph edges. When a method is called inside a `.reduce()`, `.map()`, or other callback, the call graph doesn't record the relationship.

This was identified during the entrypoint self-analysis pipeline as the **anonymous-function-body-calls-not-tracked** false positive group (1 entry).

## Problem

### Current Behavior

The `process` method in `packages/core/src/index_single_file/references/references.ts:279` appears as a false positive entry point even though it IS called.

### Root Cause

The `process` method is called at line 489 within an anonymous arrow function:

```typescript
// references.ts:485-492
export function process_references(
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference[] {
  return context.captures
    .filter(...)
    .reduce(
      (builder: ReferenceBuilder, capture) => builder.process(capture),  // Line 489
      new ReferenceBuilder(context, extractors, file_path)
    )
    .references;
}
```

The call graph analyzer:

1. Correctly identifies the anonymous arrow function as a definition
2. **Fails to track** that `builder.process(capture)` is called from within that function body
3. Results in `process` appearing to have no callers

### The Gap

The semantic indexing system captures:

- The anonymous function definition (with `callback_context.is_callback = true`)
- The external callback invocation (via `resolve_callback_invocations()`)

But it does NOT capture:

- Method calls made FROM WITHIN the anonymous function body
- The scope chain that connects the anonymous function to calls inside it

## Affected False Positives

1. `process` in `references.ts:279`

## Acceptance Criteria

- [ ] `process` method no longer appears as entry point
- [ ] Calls from anonymous function bodies are tracked in call graph
- [ ] All existing tests pass
- [ ] Test added for anonymous callback body calls

## Proposed Solution

### Option A: Track Body Calls During Reference Extraction

Ensure that when a call is made inside an anonymous function body:

1. The call reference is properly scoped to the anonymous function
2. The call graph includes the edge: anonymous function → called method
3. The called method is marked as "called by anonymous function" which chains to the callback receiver

### Option B: Transitive Closure Through Callbacks

When a callback is invoked (e.g., `items.reduce(callback)`):

1. Mark the callback as invoked (current behavior)
2. Also mark all calls INSIDE the callback body as "transitively invoked"
3. Walk the callback's body scope to find nested calls

## Files to Investigate

- `packages/core/src/resolve_references/resolve_references.ts` - `resolve_callback_invocations()` method
- `packages/core/src/index_single_file/references/references.ts` - Call extraction logic
- `packages/core/src/trace_call_graph/trace_call_graph.ts` - Entry point detection

## Related

- Part of epic-11 codebase restructuring
- Related to Task 164 (callback invocation tracking) - now completed
- Different from Task epic-11.161 (handler architecture refactor)
