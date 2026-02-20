---
id: task-177
title: Fix Ariadne entrypoint detection not recognizing imported function calls
status: Done
assignee: []
created_date: '2026-02-05 22:34'
updated_date: '2026-02-10 17:10'
labels:
  - bug
dependencies: []
---

## Description

## Problem

The entrypoint detection hook in `.claude/hooks/entrypoint_stop.ts` is incorrectly flagging internal functions as entry points even when they are imported and called from other files.

## Observed Behavior

Functions like `resolve_calls_for_files` are being detected as entry points (functions never called) despite being:

1. Exported from their module
2. Imported in another file
3. Called from the importing file

## Root Cause (IDENTIFIED)

**Self-Shadowing Bug**: When a method has the same name as an imported function, and the method body calls that imported function, name resolution incorrectly resolves to the method definition instead of the import.

### Example Pattern (found in resolve_references.ts)

```typescript
import { resolve_calls_for_files } from "./call_resolution/call_resolver";

export class ResolutionRegistry {
  // Method has SAME NAME as the imported function
  resolve_calls_for_files(file_ids, refs, ...) {
    // This call SHOULD resolve to the imported function
    // But name resolution finds the method definition first!
    const result = resolve_calls_for_files(file_ids, context, name_resolver);
    //             ^^^^^^^^^^^^^^^^^^^^^^ WRONG: resolves to this method!
  }
}
```

### Why It Happens

The name resolution algorithm in `name_resolution.ts`:

1. Starts at the call's scope (method body scope)
2. Inherits from parent scope (class scope) where the method is defined
3. Method definition shadows the import from module scope
4. Call resolves to the method, not the import

### The Fix

When resolving a name inside a method body, the method's own definition should be excluded from the lookup - you can't call a method as a bare function from within itself (without `this.`).

Alternatively, imports should always take precedence over class members when the call syntax is `funcName()` (not `this.funcName()`).

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Self-shadowing diagnostic test passes (`resolve_references.diagnostic.test.ts`)
- [x] #2 Entry point analysis of core package no longer flags `resolve_calls_for_files` as entry point
- [x] #3 Re-enable the entrypoint_stop.ts hook (remove early process.exit(0))
- [x] #4 Hook passes without blocking on false positives
<!-- AC:END -->

## Implementation Notes

### Diagnostic Test Created

A diagnostic test file was created at `packages/core/src/resolve_references/resolve_references.diagnostic.test.ts` that:

1. Tests each link in the call resolution chain independently
2. Confirms the self-shadowing bug with a minimal reproduction case
3. Can be used to verify the fix

### Entry Point Analysis Output

Running `npx tsx entrypoint-analysis/src/self_analysis/detect_entrypoints.ts --package core` shows:

- `resolve_calls_for_files` in call_resolver.ts flagged with diagnosis: `callers-in-registry-wrong-target`
- The call at line 155 in resolve_references.ts resolves to the wrapper method instead of the source function

## Reproduction

1. Re-enable the hook by removing the early `process.exit(0)` in `entrypoint_stop.ts`
2. Make a change to `packages/core/src/resolve_references/call_resolution/call_resolver.ts`
3. The hook will flag `resolve_calls_for_files` as an unexpected entry point

## Temporary Workaround

The hook is currently disabled with an early return at line 196 of `entrypoint_stop.ts`.

## Related Files

- `.claude/hooks/entrypoint_stop.ts` - The hook that detected the issue
- `packages/core/src/resolve_references/call_resolution/call_resolver.ts` - One of the flagged files
- `packages/core/src/resolve_references/resolve_references.ts` - Where the function is imported and called

## Investigation (2026-02-10)

### Self-Shadowing Fix Applied

The self-shadowing issue for `resolve_calls_for_files` was fixed in commit `5582bf99` (Skip method/constructor when resolving bare function calls). This is no longer a false positive.

### Current False Positive: `name_resolver` Arrow Function

After re-enabling the hook and running analysis, the only remaining false positive is:

```typescript
// resolve_references.ts:160
const name_resolver = (scope_id: ScopeId, name: SymbolName) =>
  resolve_in_state(this.state, scope_id, name);

// Passed as callback argument at line 164:
const result = resolve_calls_for_files(file_ids, context, name_resolver);
```

**Why it's flagged**:

1. `name_resolver` is an arrow function definition (creates a symbol)
2. It's passed as an argument to `resolve_calls_for_files`
3. Inside `call_resolver.ts:228`, the parameter `name_resolver` is called
4. The call at line 228 resolves to the **parameter** (line 138), not the **arrow function** (line 160)
5. Since nothing resolves to the arrow function definition, it appears uncalled

**Root cause**: Callback/higher-order function tracking. When a function is passed as an argument, we don't currently connect the argument value (arrow function) to the parameter that receives it.

### Fix: Function-as-Value Indirect Reachability

Extended indirect reachability detection to handle functions passed as values (not just collections).

**Changes:**

- `packages/types/src/call_chains.ts`: Added `function_reference` variant to `IndirectReachabilityReason` union type
- `packages/core/src/resolve_references/indirect_reachability.ts`: Removed duplicate type (imports from `@ariadnejs/types`), renamed `process_collection_reads` to `detect_indirect_reachability`, added function reference detection with definition-site exclusion
- `packages/core/src/resolve_references/call_resolution/call_resolver.ts`: Updated import and call site
- `packages/core/src/resolve_references/indirect_reachability.test.ts`: 6 unit tests
- `packages/core/src/resolve_references/resolution_state.test.ts`: 3 additional tests for `function_reference` variant
- Integration tests added for TypeScript, Python, Rust with fixture files
- `entrypoint-analysis/ground_truth/core.json`: Removed `name_resolver` false positive

**Key design decision:** Variable references at the same location as the function definition are excluded (Python creates variable reads at `def` sites).
