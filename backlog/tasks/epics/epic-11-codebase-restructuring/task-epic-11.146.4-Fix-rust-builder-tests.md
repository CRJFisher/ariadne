# Task epic-11.146.4: Fix rust_builder.test.ts scope setup

**Status:** Completed
**Parent:** task-epic-11.146
**Priority:** High

## Problem

rust_builder.test.ts has 48 tests skipped with incorrect "redundant with integration tests" comment.

**Same issue as JavaScript/Python builder tests** - "No body scope found" errors, but tests are NOT redundant.

## What These Tests Cover

- Rust builder configuration validation
- Individual processor functions (struct, enum, impl, trait, function)
- Rust-specific syntax (associated functions, impl blocks, lifetimes, generics)
- Metadata extraction (pub visibility, unsafe, const)
- Complex module structures

## Solution

Apply same fix as javascript/python_builder.test.ts:

1. Update test context to create proper Rust scope structures
2. Add method/function/impl scopes with correct Rust syntax patterns
3. Update failing tests to use proper context

## Rust-Specific Considerations

- Impl blocks create scopes for associated functions
- Struct definitions vs struct implementations are separate
- Associated functions (like `new()`) vs methods (with `&self`)
- Module scopes and visibility rules
- Trait implementations create scopes

## Files to Modify

- `src/index_single_file/query_code_tree/language_configs/rust_builder.test.ts`

## Success Criteria

- [x] All 48 Rust builder tests passing
- [x] No `.skip()` in rust_builder.test.ts
- [x] Tests validate Rust-specific builder behavior
- [x] No "No body scope found" warnings or errors

## Implementation Notes

### Changes Made

Applied same scope setup pattern as JavaScript/Python builder tests:

1. **Updated `createMockContext()` helper** to accept `with_scopes` parameter:
   - When `with_scopes=true`, creates function, impl, and method body scopes
   - Added scopes for "my_function", "MyStruct" impl, and "new" method

2. **Updated `processCapture()` helper** to accept 5th parameter `with_scopes: boolean = false`:
   - Passes through to `createMockContext(with_scopes)`
   - Allows tests to easily enable scope setup

3. **Updated 13 function/method/macro tests** to pass `true` as 5th parameter:
   - 5 function definition tests (simple, async, const, unsafe, generic)
   - 2 method definition tests (instance method, associated function)
   - 1 macro definition test
   - 5 is_exported flag tests for functions (pub fn, private fn, pub(crate) fn, pub async fn, pub unsafe fn)

4. **Fixed 2 method tests with custom scope setup**:
   - "should process instance method" - created dynamic scope matching actual method location
   - "should process associated function (static method)" - created dynamic scope matching actual method location

5. **Removed obsolete skip and comment**:
   - Removed `describe.skip()`
   - Removed 4-line comment claiming tests were redundant

### Pattern Applied

For most tests:

```typescript
const result = processCapture(code, captureName, nodeType, expectedText, true);
```

For method tests that needed dynamic scopes:

```typescript
const method_scope_id = `method:test.rs:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:<method_body>`;
scopes.set(method_scope_id, { ... });
```

### Results

- **Before**: 48 tests skipped, 2 failing with "No body scope found" errors
- **After**: All 48 tests passing (44ms) with **no warnings or errors**
- **Tests validate Rust-specific features**: impl blocks, associated functions, pub visibility, unsafe, const, async, generics

### Files Modified

- [rust_builder.test.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.test.ts)

## Reference

Applied same pattern as javascript/python_builder.test.ts fixes (commits 17f87af, f42781e).
