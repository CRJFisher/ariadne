---
id: TASK-203
title: Fix callback resolution for self_reference_call receivers
status: To Do
assignee: []
created_date: "2026-04-01 17:26"
labels:
  - bug
  - call-resolution
  - entry-point-detection
dependencies: []
references:
  - packages/core/src/resolve_references/call_resolution/call_resolver.ts
  - packages/core/src/index_single_file/definitions/definitions.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

### Problem

Anonymous callbacks passed to `this.X.forEach(...)` are detected as false positive entry points. Five instances currently exist in `DefinitionBuilder.build()` at `definitions.ts` lines 201-213.

### Root Cause

`resolve_callback_invocations` in `call_resolver.ts` (line ~426) only matches `"function_call"` or `"method_call"` references when linking callbacks to their invoking call:

```typescript
(ref.kind === "function_call" || ref.kind === "method_call") &&
```

But `this.X.forEach(...)` produces a `"self_reference_call"` reference (because `extract_property_chain` sees `this` as a self-keyword). Since `"self_reference_call"` is excluded from the match, the callback is never linked — it appears as an uncalled definition and gets flagged as an entry point.

Plain `items.forEach(...)` works correctly because it produces a `"method_call"` reference.

### Fix

Add `"self_reference_call"` to the kind check in `resolve_callback_invocations`:

```typescript
(ref.kind === "function_call" || ref.kind === "method_call" || ref.kind === "self_reference_call") &&
```

This is semantically correct: `self_reference_call` references have the same `call_expression` location that `detect_callback_context` stores in `receiver_location`.

### After fixing

Remove the 5 false-positive entries added to `.claude/self-repair-pipeline-state/known_entrypoints/core.json` for `definitions.ts` anonymous functions.

<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 self_reference_call receivers are matched in resolve_callback_invocations
- [ ] #2 this.X.forEach callbacks no longer appear as false positive entry points
- [ ] #3 Integration test covers this.X.method(callback) pattern
- [ ] #4 Remove known_entrypoints workaround entries for definitions.ts
<!-- AC:END -->
