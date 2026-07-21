# Task 11.136.2: Implement JavaScript Assignment Type Tracking

**Parent Task**: 11.136 - Implement Assignment Type Tracking
**Status**: TODO (Test updates completed, JavaScript implementation needed)
**Priority**: High
**Estimated Effort**: 1-2 days

## Context

Task 11.136.1 investigation revealed:

- ✅ **TypeScript assignment tracking WORKS** - Cross-file method resolution succeeds
- ❌ **JavaScript assignment tracking FAILS** - Method calls not being resolved
- ✅ **Test infrastructure updated** - Now uses proper `get_file_calls()` integration approach

**Evidence from JavaScript fixture testing:**
- Fixture `uses_user.js` has 10 method call references
- Only 2 resolved calls returned (both are constructors, `call_type='function'`)
- 0 method calls resolved (expected: 10)

**Root Cause:** Language-specific issue - TypeScript infrastructure works but JavaScript implementation is incomplete or has bugs.

## Problem Analysis

### Current Test Approach (WRONG)

Tests currently:
1. Call `project.update_file()` to process files
2. Find method call references manually
3. Call **internal** resolver function or wrong API: `project.resolutions.resolve(scope, name)`
4. Check if resolution worked

**Issues:**
- Not testing the actual integration - bypassing the real resolution pipeline
- Using name resolution API for call resolution
- Calling internal functions that aren't part of public API

### Correct Test Approach (Integration Test Spirit)

Tests should:
1. Call `project.update_file()` with fixture files containing the test scenario
2. Verify resolution happened by checking **Project's public API** for resolved calls
3. Use existing fixture files (e.g., `uses_user.js`) that already contain cross-file method calls

**Benefits:**
- True end-to-end test through public API
- Tests actual integration, not isolated components
- Reuses existing fixture files
- Matches how users actually use the Project class

## Implementation Plan

### Option 1: Add Public API to Check Resolved Calls (RECOMMENDED)

Add a method to Project class to check if a call was resolved:

```typescript
// In project.ts:
get_resolved_calls(file_path: FilePath): readonly CallReference[] {
  return this.resolutions.get_calls_by_file(file_path);
}
```

Then tests verify calls are resolved:

```typescript
const resolved_calls = project.get_resolved_calls("uses_user.js" as FilePath);
const get_name_call = resolved_calls.find(c => c.name === "get_name");
expect(get_name_call).toBeDefined();
expect(get_name_call?.symbol_id).toBeDefined();

// Verify it points to the method in user_class.js
const method_def = project.definitions.get(get_name_call!.symbol_id);
expect(method_def?.location.file_path).toContain("user_class");
```

### Option 2: Use Existing get_calls_by_caller_scope (SIMPLEST)

Use the existing ResolutionRegistry API:

```typescript
const main_index = project.get_semantic_index("main.ts" as FilePath);
const module_scope = main_index!.module_scope_id;

const resolved_calls = project.resolutions.get_calls_by_caller_scope(module_scope);
const get_name_call = resolved_calls.find(c => c.name === "getName");

expect(get_name_call).toBeDefined();
expect(get_name_call?.symbol_id).toBeDefined();
```

**Recommendation:** Use Option 2 - it already exists and is part of ResolutionRegistry's public API.

## Implementation Steps

### Step 1: Update TypeScript Cross-File Test (0.05 days)

**File:** `packages/core/src/project/project.integration.test.ts:325`

**Change:**
```typescript
it("should resolve method calls on imported classes across files in TypeScript", async () => {
  project.update_file("types.ts" as FilePath, `
export class User {
  getName() { return "Alice"; }
}
  `);
  project.update_file("main.ts" as FilePath, `
import { User } from "./types";
const user = new User();
const name = user.getName();
  `);

  const main_index = project.get_semantic_index("main.ts" as FilePath);
  const module_scope = main_index!.module_scope_id;

  // Get all resolved calls from main.ts module scope
  const resolved_calls = project.resolutions.get_calls_by_caller_scope(module_scope);

  // Find the getName method call
  const get_name_call = resolved_calls.find(
    (c) => c.name === ("getName" as SymbolName) && c.call_type === "method"
  );
  expect(get_name_call).toBeDefined();
  expect(get_name_call?.symbol_id).toBeDefined();

  // Verify it resolves to method in types.ts
  const resolved_def = project.definitions.get(get_name_call!.symbol_id);
  expect(resolved_def?.location.file_path).toContain("types.ts");
  expect(resolved_def?.name).toBe("getName" as SymbolName);
  expect(resolved_def?.kind).toBe("method");
});
```

### Step 2: Update JavaScript Integration Tests (0.05 days)

**Files:**
- `packages/core/src/project/project.javascript.integration.test.ts:480`
- `packages/core/src/project/project.javascript.integration.test.ts:647`

Apply same pattern as Step 1, using existing fixture files and `get_calls_by_caller_scope()`.

### Step 3: Verify Python Test Uses Same Pattern (Optional)

Check if Python test at line 269 should also be updated for consistency.

## Testing Strategy

### Test Updates

- Update 3 integration tests to use `get_calls_by_caller_scope()`
- Remove `.todo()` from test declarations
- Verify tests now pass

### Validation

- Run full test suite to ensure no regressions
- All 1,418+ tests should still pass
- Python test should still work (may need same update for consistency)

## Acceptance Criteria

- [x] Root cause identified - Tests using wrong verification API
- [ ] Integration tests updated to use proper call resolution checking
- [ ] All 3 previously-failing tests now pass
- [ ] No regressions in existing tests
- [ ] Tests use true integration approach (public API only)

## Deliverables

- [ ] Updated TypeScript cross-file test (project.integration.test.ts:325)
- [ ] Updated JavaScript imported instances test (project.javascript.integration.test.ts:480)
- [ ] Updated JavaScript aliased instances test (project.javascript.integration.test.ts:647)
- [ ] Optional: Update Python test for consistency (project.python.integration.test.ts:269)

## Success Criteria

- [ ] All updated tests pass
- [ ] Tests verify end-to-end integration through Project API
- [ ] Tests use `get_calls_by_caller_scope()` to check resolved calls
- [ ] No direct calls to internal resolver functions
- [ ] Entry points expected to remain at 101 (infrastructure already worked)
