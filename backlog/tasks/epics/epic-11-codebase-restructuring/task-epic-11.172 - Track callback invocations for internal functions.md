---
id: task-epic-11.172
title: Track callback invocations for internal functions
status: Done
assignee: []
created_date: '2026-01-20'
labels:
  - bug
  - call-graph
  - epic-11
dependencies: []
---

## Description

Higher-order function callback invocations are not tracked as call graph edges when the callback is passed to an **internal** function. The `resolve_callback_invocations()` method only creates invocation edges for callbacks passed to **external** functions, leaving internal function callbacks unmarked as called.

This was identified during the entrypoint self-analysis pipeline as the **callback-invocation-not-tracked** false positive group (2 entries).

## Problem

### Current Behavior

In `packages/core/src/resolve_references/resolve_references.ts`, the `resolve_callback_invocations()` method (lines 734-837) classifies callbacks based on whether the receiver function is internal or external:

```typescript
// Lines 790-816 - Classification logic
const receiver_symbol_id = this.resolve(
  receiver_call.scope_id,
  receiver_call.name
);

let is_external = false;

if (!receiver_symbol_id) {
  is_external = true;  // Can't resolve → external
} else {
  const receiver_def = definitions.get(receiver_symbol_id);
  if (!receiver_def) {
    is_external = true;  // Resolved but no definition → external
  } else {
    is_external = false; // Has definition in our code → INTERNAL
  }
}

// Only create invocation edge for external callbacks
if (is_external) {
  invocations.push({...});
}
```

**The Bug**: When `is_external = false` (internal function), no invocation edge is created. The callback remains unmarked as called and appears as a false positive entry point.

### Example

```typescript
// resolve_references.ts:334
const callback = (import_id) => imports.get_resolved_import_path(import_id);
resolve_method_call(context, callback);  // callback passed to INTERNAL function

// method_lookup.ts:46
const source_file = context.resolve_import_path
  ? context.resolve_import_path(receiver_type)  // callback invoked here
  : undefined;
```

The callback at line 334 is passed to `resolve_method_call` (internal), which invokes it at method_lookup.ts:46. Since `resolve_method_call` is internal, no invocation edge is created, and the callback incorrectly appears as an entry point.

## Affected False Positives

1. `<anonymous>` in `resolve_references.ts:279`
2. `<anonymous>` in `resolve_references.ts:334`

## Acceptance Criteria

- [ ] Callback invocation tracking creates edges for both internal and external function callbacks
- [ ] Both false positive entries are eliminated from entrypoint detection
- [ ] Anonymous callbacks passed to internal functions are marked as called
- [ ] Tests verify callback tracking works for internal function callbacks
- [ ] All existing tests pass

## Proposed Solution

Extend the callback tracking logic to also create invocation edges for internal functions:

**Current (only external):**

```typescript
if (is_external) {
  invocations.push({...});
}
```

**Fixed (both internal and external):**

```typescript
// Create invocation edge for ALL callbacks, internal or external
invocations.push({...});
```

Or if we need to differentiate:

```typescript
// Always track callback invocations
// The is_external flag can be stored for other purposes if needed
invocations.push({
  ...existingFields,
  is_external_receiver: is_external
});
```

## Files to Modify

- `packages/core/src/resolve_references/resolve_references.ts` - `resolve_callback_invocations()` method (lines 815-833)

## Test Cases

1. Callback passed to internal function is marked as called
2. Callback passed to external function is marked as called (existing behavior)
3. Anonymous arrow functions passed as parameters are tracked correctly
4. Named function references passed as callbacks are tracked correctly

## Related

- Part of epic-11 codebase restructuring
- Also addresses **anonymous-function-parameter-bug** group (misclassified - same underlying issue)
