# Task 11.106.8: Update All Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.106
**Dependencies:** task-epic-11.106.7 (optional chain implemented)

## Objective

Update all test files to reflect the simplified `SymbolReference` structure:
- **DELETE** assertions on deleted fields (`source_type`, `is_narrowing`, `is_widening`, `containing_function`)
- Update `type_flow.target_type` → `assignment_type`
- Add tests for `is_optional_chain` functionality
- Ensure zero test regressions

**CRITICAL:** This task removes ALL test assertions on fields that were deleted in previous sub-tasks. Test assertions are NOT considered "usage" - they should be deleted along with the fields they test.

## Test Categories to Update

### 1. Reference Builder Tests

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.test.ts`

Changes needed:
- Update assertions that check `type_flow` structure
- Add optional chain detection tests
- Verify simplified structure

### 2. Metadata Extractor Tests

**Files:**
- `javascript_metadata.test.ts` - Add optional chain tests (done in 11.106.7)
- `typescript_metadata.test.ts` - Add optional chain tests
- `python_metadata.test.ts` - Verify no optional chain (returns false)
- `rust_metadata.test.ts` - Verify no optional chain (returns false)

### 3. Semantic Index Integration Tests

**Files:**
- `semantic_index.javascript.test.ts`
- `semantic_index.typescript.test.ts`
- `semantic_index.python.test.ts`
- `semantic_index.rust.test.ts`

Changes needed:
- Update references assertions
- Test optional chain in integration
- Verify `assignment_type` field

## Search and Replace Patterns

### Pattern 1: type_flow.target_type → assignment_type

```bash
# Find all references
rg "type_flow\.target_type" --type ts --glob "*test.ts"

# For each match, replace:
# OLD: reference.type_flow?.target_type
# NEW: reference.assignment_type
```

### Pattern 2: type_flow structure checks

```bash
# Find type_flow checks
rg "type_flow\?" --type ts --glob "*test.ts"

# Replace nested checks with direct checks:
# OLD: expect(ref.type_flow?.target_type).toBeDefined()
# NEW: expect(ref.assignment_type).toBeDefined()
```

### Pattern 3: Remove deleted field checks

```bash
# Find references to deleted fields in tests
rg "source_type|is_narrowing|is_widening|containing_function" --type ts --glob "*test.ts"

# DELETE these test assertions entirely
# Examples of what to remove:
# - expect(ref.type_flow?.source_type).toBeUndefined()
# - expect(ref.type_flow?.is_narrowing).toBe(false)
# - expect(ref.context?.containing_function).toBeDefined()
```

**Important:** Delete the entire test assertion block, not just the field name. For example:

```typescript
// ❌ DELETE this entire test case
it("should not have source type for assignments", () => {
  expect(reference.type_flow?.source_type).toBeUndefined();
});

// ❌ DELETE these assertions from existing tests
expect(reference.type_flow?.is_narrowing).toBe(false);
expect(reference.type_flow?.is_widening).toBe(false);
```

## New Tests to Add

### Optional Chain Tests (JavaScript/TypeScript)

```typescript
describe("SymbolReference - optional chaining", () => {
  it("detects optional method call", () => {
    const code = `
      obj?.method()
    `;
    const references = /* extract references */;
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(true);
  });

  it("detects regular method call as non-optional", () => {
    const code = `
      obj.method()
    `;
    const references = /* extract references */;
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("detects chained optional property access", () => {
    const code = `
      obj?.prop?.nested
    `;
    const references = /* extract references */;
    const propRef = references.find(r => r.name === "nested");

    expect(propRef?.member_access?.is_optional_chain).toBe(true);
  });
});
```

### Assignment Type Tests

```typescript
describe("SymbolReference - assignment_type", () => {
  it("captures assignment type annotation", () => {
    const code = `
      const x: string = getValue()
    `;
    const references = /* extract references */;
    const assignRef = references.find(r => r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toBe("string");
  });

  it("does not populate assignment_type for non-assignments", () => {
    const code = `
      const x = getValue()
      x()
    `;
    const references = /* extract references */;
    const callRef = references.find(r => r.call_type === "function");

    expect(callRef?.assignment_type).toBeUndefined();
  });
});
```

## Verification Steps

### 1. Individual Test Files

Run each test file individually:

```bash
npx vitest reference_builder.test.ts
npx vitest javascript_metadata.test.ts
npx vitest typescript_metadata.test.ts
npx vitest python_metadata.test.ts
npx vitest rust_metadata.test.ts
npx vitest semantic_index.javascript.test.ts
# ... etc
```

### 2. Full Test Suite

Run all tests to check for regressions:

```bash
npm test
```

Expected: Same pass/fail count as before task 11.106 started.

### 3. Coverage Check

Verify test coverage didn't decrease:

```bash
npm test -- --coverage
```

Expected: Coverage maintains or improves.

## Success Criteria

- ✅ All test files updated to use new structure
- ✅ No references to deleted fields in tests
- ✅ `type_flow` replaced with `assignment_type` in all tests
- ✅ Optional chain tests added for JS/TS
- ✅ All tests pass (zero new failures)
- ✅ No test regressions
- ✅ Test coverage maintained

## Potential Issues and Solutions

### Issue: Tests expect type_flow structure

**Solution:** Update assertions to use `assignment_type` directly.

**Example:**
```typescript
// OLD
expect(ref.type_flow).toBeDefined();
expect(ref.type_flow?.target_type?.type_name).toBe("string");

// NEW
expect(ref.assignment_type).toBeDefined();
expect(ref.assignment_type?.type_name).toBe("string");
```

### Issue: Tests check for is_narrowing/is_widening

**Solution:** Delete these assertions entirely (fields no longer exist).

### Issue: New extractor return type breaks tests

**Solution:** Update tests to destructure new return format:

```typescript
// OLD
const location = extract_call_receiver(node, file_path);

// NEW
const result = extract_call_receiver(node, file_path);
const location = result?.location;
const is_optional = result?.is_optional;
```

## Files to Update (Checklist)

- [ ] `reference_builder.test.ts` - Update type_flow assertions
- [ ] `javascript_metadata.test.ts` - Add optional chain tests
- [ ] `typescript_metadata.test.ts` - Add optional chain tests
- [ ] `python_metadata.test.ts` - Verify returns false
- [ ] `rust_metadata.test.ts` - Verify returns false
- [ ] `semantic_index.javascript.test.ts` - Integration tests
- [ ] `semantic_index.typescript.test.ts` - Integration tests
- [ ] `semantic_index.python.test.ts` - Integration tests
- [ ] `semantic_index.rust.test.ts` - Integration tests

## Notes

This task ensures the test suite remains comprehensive while adapting to the simplified interface. The goal is:

1. **No functionality loss** - All features still tested
2. **Better tests** - Simpler assertions match simpler API
3. **New coverage** - Optional chain detection now tested
4. **Zero regressions** - All previously passing tests still pass
