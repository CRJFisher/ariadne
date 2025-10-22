# Task epic-11.146.2: Fix javascript_builder.test.ts scope setup

**Status:** Completed
**Parent:** task-epic-11.146
**Priority:** High

## Problem

javascript_builder.test.ts has 32 tests skipped with comment claiming they're "redundant with integration tests" due to "No body scope found" errors.

**This assessment was WRONG.** These tests are NOT redundant - they test the builder configuration API at a different level than integration tests.

## What These Tests Cover

Builder tests validate:
- Builder configuration structure is correct
- Individual processor functions work (class, function, variable, method, import)
- Metadata extractors function properly (JSDoc, decorators, types)
- All required definition fields are populated
- Edge cases in JavaScript syntax parsing

**Integration tests test end-to-end pipeline. Builder tests test granular processor behavior.**

## Solution

Apply the same fix used for definition_builder.test.ts:

1. **Update test context helper** to create proper scopes:
   ```typescript
   function create_test_context(with_scopes: boolean = false): ProcessingContext {
     const scopes = new Map();
     if (with_scopes) {
       // Add method body scopes, function scopes, etc.
       // Each scope needs: id, type, name, location, parent_id
     }
     return { captures: [], scopes, scope_depths, root_scope_id, get_scope_id };
   }
   ```

2. **Update failing tests** to use `create_test_context(true)`

3. **Add scope entries** for each method/function being tested

## Files to Modify

- `src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts`

## Success Criteria

- [x] All 32 JavaScript builder tests passing
- [x] No `.skip()` in javascript_builder.test.ts
- [x] Tests validate builder config API properly
- [x] Comment explaining redundancy is removed

## Implementation Notes

### Changes Made

Applied the same scope setup pattern used for definition_builder.test.ts:

1. **Updated `createTestContext()` helper** to accept `with_scopes` parameter:
   - When `with_scopes=true`, creates method and function body scopes
   - Added scopes for "myMethod", "add", and "myFunc" to support tests

2. **Updated 4 tests** to use `createTestContext(true)`:
   - "should process method definitions in classes"
   - "should process class properties"
   - "should process function parameters"
   - "should capture and attach JSDoc documentation to methods"

3. **Fixed import mapping names** in 2 tests:
   - Changed `"import.default"` → `"definition.import.default"`
   - Changed `"import.named"` etc. → `"definition.import.named"` etc.

4. **Removed obsolete skip and comment**:
   - Removed `describe.skip()`
   - Removed 4-line comment claiming tests were redundant

### Results

- **Before**: 32 tests skipped, all failing with "No body scope found"
- **After**: All 32 tests passing (34ms)
- **No worker crashes**: Tests run reliably
- **Validates builder API**: Tests now properly test granular processor behavior

### Files Modified

- [javascript_builder.test.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.test.ts)

## Reference

See commit `af100fe` that fixed definition_builder.test.ts for implementation pattern.
