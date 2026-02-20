# Task epic-11.146.7: Fix or delete edge case skipped tests

**Status:** Completed
**Parent:** task-epic-11.146
**Priority:** Low

## Problem

2 scattered edge case tests are skipped:

### 1. semantic_index.typescript.test.ts (1 test)
```typescript
it.skip("should handle nested functions with correct body_scope_id mapping", () => {
```

**Investigation:**
- Why was this skipped? No comment explaining.
- Is nested function body_scope_id working correctly?
- Check if integration tests cover nested functions
- Try enabling test to see what breaks

**Options:**
- ✅ Fix if it's a simple issue
- 🗑️ Delete if covered by integration tests
- 📝 Document why it's hard to test at this level

---

### 2. scope_boundary_extractor.test.ts (1 test)
```typescript
it.skip("should return PythonScopeBoundaryExtractor for python", () => {
```

**Investigation:**
- Why was this skipped? No comment explaining.
- Does PythonScopeBoundaryExtractor exist?
- Is the factory working for Python?
- Check if integration tests cover Python scope extraction

**Options:**
- ✅ Fix if extractor exists and test just needs update
- 🗑️ Delete if not relevant or covered elsewhere
- 🔄 Keep if Python support is incomplete (but document)

## Investigation Steps

For each test:

1. **Enable the test** - See what error occurs
2. **Check integration tests** - Is this covered end-to-end?
3. **Decide:**
   - Can be fixed easily? → Fix it
   - Covered elsewhere? → Delete it
   - Complex issue? → Document and consider creating dedicated task

## Files to Modify

- `src/index_single_file/semantic_index.typescript.test.ts`
- `src/index_single_file/scopes/scope_boundary_extractor.test.ts`

## Success Criteria

- [x] Nested function body_scope_id test PASSING
- [x] Python extractor test PASSING
- [x] No `.skip()` calls in these files
- [x] Both tests provide valuable validation coverage

## Implementation Notes

### Investigation Results

**Both tests PASS immediately after removing .skip()!**

1. **Nested function test (semantic_index.typescript.test.ts)**:
   - Tests 3 levels of nested functions (level1 → level2 → level3)
   - Verifies each has proper body_scope_id
   - Verifies scopes exist with correct type and name
   - **Result**: ✅ PASSES - no issues found

2. **Python extractor test (scope_boundary_extractor.test.ts)**:
   - Tests that factory returns PythonScopeBoundaryExtractor for "python" language
   - Had TODO comment claiming "require path issues in test environment"
   - **Result**: ✅ PASSES - the "issue" was resolved or never existed
   - PythonScopeBoundaryExtractor exists and is returned correctly

### Changes Made

1. **Removed .skip() from nested function test**:
   - File: semantic_index.typescript.test.ts line 2753
   - Test: "should handle nested functions with correct body_scope_id mapping"
   - No other changes needed - test works perfectly

2. **Removed .skip() and TODO comment from Python extractor test**:
   - File: scope_boundary_extractor.test.ts line 49
   - Test: "should return PythonScopeBoundaryExtractor for python"
   - Removed misleading TODO about "require path issues"
   - No other changes needed - test works perfectly

### Results

- **Before**: 2 tests skipped with unclear reasons
- **After**: Both tests passing
- **Nested function test**: Now part of 49 passing tests in semantic_index.typescript.test.ts
- **Python extractor test**: Now part of 72 passing tests in scope_boundary_extractor.test.ts

### Why Were These Skipped?

Both tests appear to have been skipped unnecessarily:

1. **Nested function test**: No comment explaining why - likely a mistake or outdated skip
2. **Python extractor test**: TODO claimed "require path issues" but test passes without any changes

These tests provide valuable validation coverage that was missing.

### Files Modified

- [semantic_index.typescript.test.ts](../../../packages/core/src/index_single_file/semantic_index.typescript.test.ts) - Removed .skip()
- [scope_boundary_extractor.test.ts](../../../packages/core/src/index_single_file/scopes/scope_boundary_extractor.test.ts) - Removed .skip() and TODO comment
