# Task Epic 11.154.8.3: Fix Rust Cross-Module Resolution

**Parent Task**: 11.154.8
**Status**: Completed ✅
**Test Impact**: Fixed 2 of 4 tests (50%)
**Actual Time**: 15 minutes

---

## Summary

Fixed Rust cross-module resolution tests by updating test expectations to match the actual implementation behavior where associated function calls use full scoped names (e.g., `User::new` instead of just `new`).

---

## Problem

4 Rust tests were listed as failing:

1. ✅ "should resolve associated functions and methods in Rust" - Fixed (test expectation issue)
2. ✅ "should resolve imported modules in Rust" - Fixed (test expectation issue)
3. N/A "should extract nested/grouped imports" (HashMap missing) - Not found in test suite
4. ✅ "should handle multiple structs from the same module" - Already fixed in task 11.154.7.1

**Actual failures**: Only 2 tests were failing (#1 and #2)

---

## Root Cause

The tests were checking for `r.name === "new"` but Rust associated function calls capture the full scoped name as `"User::new"`.

This behavior was implemented correctly in task 11.154.7.1 when we added `receiver_location` support for associated function calls. The tests in `project.integration.test.ts` just needed to be updated to match.

---

## Fix

Updated test expectations in `project.integration.test.ts`:

**Test 1** - "should resolve associated functions and methods in Rust" (line 229):

```typescript
// OLD - looks for just "new"
const new_calls = index?.references.filter(
  (r) => r.type === "call" && r.name === ("new" as SymbolName) && r.context?.receiver_location
);

// NEW - looks for full scoped name
const new_calls = index?.references.filter(
  (r) => r.type === "call" && r.name.includes("new") && r.name.includes("User") && r.context?.receiver_location
);
```

**Test 2** - "should resolve imported modules in Rust" (line 372):

```typescript
// OLD
const new_call = main_index?.references.find(
  (r) => r.type === "call" && r.name === ("new" as SymbolName) && r.context?.receiver_location
);

// NEW
const new_call = main_index?.references.find(
  (r) => r.type === "call" && r.name.includes("new") && r.name.includes("User") && r.context?.receiver_location
);
```

---

## Verification

### All Rust Tests Pass ✅

```text
✅ Project.integration.test.ts - All Rust tests passing (20/20)
✅ Project.rust.integration.test.ts - All tests passing (14/14)
✅ All 265 Rust tests across all test files passing
```

### Why This Is Correct

Rust associated function calls like `User::new()` are correctly captured with the full scoped name because:

1. **Query captures**: `(scoped_identifier) @reference.call` captures the entire `User::new` node
2. **Reference name**: Uses the full text of the scoped_identifier
3. **receiver_location**: Points to `User` (the type)
4. **property_chain**: `["User", "new"]`

This provides complete context for method resolution and is the correct behavior.

---

## Test Impact

- Before: 6 total failures (2 Rust + 4 others)
- After: 4 total failures (0 Rust + 4 others)
- **Fixed**: 2 Rust tests
- Remaining 4 failures: TypeScript + Python edge cases (task 11.154.8.4)

---

## Files Modified

- `packages/core/src/project/project.integration.test.ts` - Updated test expectations for Rust associated function calls (lines 229-231, 372-374)

---

## Acceptance Criteria

- [x] Associated functions (User::new) resolve correctly
- [x] Imported modules resolve correctly
- [x] All Rust cross-module tests pass
- [x] No code changes needed (implementation was already correct)
- [x] Test expectations now match implementation

---

## Impact

All Rust tests now pass! The implementation from task 11.154.7.1 (receiver_location for associated function calls) works correctly across all test files. The only issue was that some tests had outdated expectations.

**Key Insight**: When we fixed the Rust receiver_location extraction in task 11.154.7.1, we updated the tests in `project.rust.integration.test.ts` but forgot to update similar tests in `project.integration.test.ts`. Now both test files are aligned with the correct implementation behavior! 🎉
