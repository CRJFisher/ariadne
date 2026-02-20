# Task epic-11.146.3: Fix python_builder.test.ts scope setup

**Status:** Completed
**Parent:** task-epic-11.146
**Priority:** High

## Problem

python_builder.test.ts has 56 tests skipped with incorrect "redundant with integration tests" comment.

**Same issue as JavaScript builder tests** - "No body scope found" errors, but tests are NOT redundant.

## What These Tests Cover

- Python builder configuration validation
- Individual processor functions (class, function, method, decorator)
- Python-specific syntax (decorators, list comprehensions, generators)
- Metadata extraction (type hints, docstrings)
- Import statement variations (from X import Y, import X as Y)

## Solution

Apply same fix as javascript_builder.test.ts:

1. Update test context to create proper Python scope structures
2. Add method/function scopes with correct Python syntax patterns
3. Update failing tests to use proper context

## Python-Specific Considerations

- Python uses `:` for scope boundaries (not `{` like JS/TS)
- Methods in classes have implicit `self` parameter
- Decorators need special handling
- List comprehensions create their own scopes

## Files to Modify

- `src/index_single_file/query_code_tree/language_configs/python_builder.test.ts`

## Success Criteria

- [x] All 56 Python builder tests passing
- [x] No `.skip()` in python_builder.test.ts
- [x] Tests validate Python-specific builder behavior
- [x] No "No body scope found" warnings

## Implementation Notes

### Changes Made

Applied same scope setup pattern as JavaScript builder tests:

1. **Updated `createTestContext()` helper** to accept `with_scopes` parameter:
   - When `with_scopes=true`, creates method and function body scopes
   - Added scopes for "my_method", "**init**", and "my_function"

2. **Updated 11 function-related tests** to use `createTestContext(true)`:
   - "should handle a function definition"
   - "should handle async functions"
   - "should handle lambda functions"
   - "should handle function with typed parameters"
   - All 7 tests in "Export flag verification > Functions" section

3. **Removed obsolete skip and comment**:
   - Removed `describe.skip()`
   - Removed 4-line comment claiming tests were redundant

### Pattern Applied

Changed from:

```typescript
const builder = new DefinitionBuilder(createTestContext());
config?.process(capture, builder, createTestContext());
```

To:

```typescript
const context = createTestContext(true); // Need scopes for function bodies
const builder = new DefinitionBuilder(context);
config?.process(capture, builder, context);
```

### Results

- **Before**: 56 tests skipped, generating "No body scope found" warnings
- **After**: All 56 tests passing (31ms) with **no warnings**
- **Tests validate Python-specific behavior**: decorators, type hints, lambda functions, async functions

### Files Modified

- [python_builder.test.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/python_builder.test.ts)

## Reference

Applied same pattern as javascript_builder.test.ts fix (commit 17f87af).
