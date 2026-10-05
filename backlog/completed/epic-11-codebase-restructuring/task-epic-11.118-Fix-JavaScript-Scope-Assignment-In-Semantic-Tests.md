# Task: Fix JavaScript Scope Assignment In Semantic Tests

**Status**: Completed
**Epic**: epic-11 - Codebase Restructuring
**Created**: 2025-10-07
**Completed**: 2025-10-07

## Problem

The [semantic_index.javascript.test.ts](packages/core/src/index_single_file/semantic_index.javascript.test.ts) file has 5 test failures related to scope assignment:

### Failure Pattern

Tests are failing with scope ID mismatches where references are being assigned to nested/wrong scopes:

```
Expected scope: class:MyClass
Actual scope: method:myMethod::class:MyClass
```

This suggests that:
1. References within class methods are being assigned to the method scope instead of class scope
2. The scope hierarchy is incorrect for certain reference types
3. File-level definitions may be getting nested scope assignments

### Affected Test Cases

From test output:
- "should extract class with complete structure including constructor, methods, and properties"
- "should extract functions with complete structure"
- "should extract variables and constants with complete structure"
- "should extract imports with complete structure"
- "should capture only class body as scope for class declaration"

## Root Cause

This is similar to issues previously fixed in TypeScript/Python scope processors. The JavaScript language config may have:
- Incorrect scope assignment logic in reference builders
- Missing scope boundary detection
- Wrong parent scope selection in nested contexts

## Solution

1. **Investigate scope assignment in JavaScript builders**:
   - Review `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
   - Check reference builder scope assignment logic
   - Compare with TypeScript/Python implementations

2. **Fix scope assignment**:
   - Ensure file-level references get file scope
   - Ensure class member references get class scope (not method scope)
   - Verify nested class scope handling

3. **Update tests**:
   - Run `npm test -- semantic_index.javascript.test.ts`
   - Verify all scope assignments are correct

## Testing

```bash
cd packages/core
npm test -- semantic_index.javascript.test.ts
```

All tests should pass after fixes.

## Related

- Similar issues were fixed in task-epic-11.112 for TypeScript/Python
- See scope consolidation work in epic-11.112 tasks

## Implementation Notes

### Investigation Results

1. **Tests Already Passing**: Upon investigation, all 35 JavaScript semantic tests in `semantic_index.javascript.test.ts` were already passing. The scope assignment issues described in the problem statement had already been resolved by commit c1b8277 (Oct 6, 2025) which updated JavaScript .scm to use body-based scopes for classes.

2. **Root Cause Identified**: The task description was based on an out-of-date understanding of the codebase state. The body-based scope changes made in task-epic-11.112.6.1 had already fixed the scope assignment issues.

### Issue Found and Fixed

However, during comprehensive testing, discovered a related bug in the **body-based scope verification tests**:

**Problem**: `body_based_scope_verification.test.ts` had an incorrect `createParsedFile` helper that was calculating `file_end_column` incorrectly:

```typescript
// INCORRECT (missing +1)
file_end_column: lines[lines.length - 1]?.length || 0,
```

This should have been:

```typescript
// CORRECT (1-indexed with exclusive end)
file_end_column: (lines[lines.length - 1]?.length || 0) + 1,
```

**Impact**: This caused scope ID mismatches where the file scope ID didn't match the scope ID assigned to definitions, causing JavaScript body-based scope verification tests to fail.

**Fix**: Updated the helper function in [body_based_scope_verification.test.ts:39](packages/core/src/index_single_file/scopes/body_based_scope_verification.test.ts#L39) to correctly calculate `file_end_column` by adding the `+ 1` offset, matching the implementation in `semantic_index.javascript.test.ts`.

### Test Results

After the fix:
- ✅ All 35 JavaScript semantic tests passing (1 skipped - JSDoc support)
- ✅ All JavaScript body-based scope verification tests passing (2 tests)
- ✅ Scope assignment working correctly for:
  - Class declarations and expressions
  - Functions and methods
  - Variables and constants
  - Imports
  - File-level vs nested scopes

### Key Verification Points

1. **Class body-based scopes**: Class scope starts at `{` (body), not at `class` keyword
2. **Class names in module scope**: Class definitions are assigned to module scope, not class scope
3. **Scope hierarchy**: Class scope parent is module scope
4. **Column indexing**: File end columns use 1-indexed positions with exclusive ends

### Files Modified

1. `packages/core/src/index_single_file/scopes/body_based_scope_verification.test.ts` - Fixed `createParsedFile` helper
