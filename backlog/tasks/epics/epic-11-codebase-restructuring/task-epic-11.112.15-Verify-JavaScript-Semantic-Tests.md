# Task epic-11.112.15: Verify JavaScript Semantic Tests

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 test file to verify/fix
**Dependencies:** tasks epic-11.112.5-11.112.7 (JavaScript scope fixes)

## Objective

Ensure all JavaScript semantic index tests pass after scope assignment changes. Fix any test expectations that are affected by the new `get_defining_scope_id()` behavior.

## Files

### VERIFY/FIX
- `packages/core/src/index_single_file/semantic_index.javascript.test.ts`

## Implementation Steps

### 1. Run JavaScript Semantic Tests (15 min)

```bash
npm test -- semantic_index.javascript.test.ts
```

Document baseline:
- Total tests: X
- Passing: Y
- Failing: Z
- Failures related to scope changes: [list]

### 2. Analyze Failures (30 min)

For each failing test:
1. Read the test code
2. Identify what it's testing
3. Check if failure is due to scope_id changes
4. Determine if test expectation needs updating

Common patterns to look for:
```typescript
// Old expectation (might be wrong now):
expect(class_def.scope_id).toBe(some_method_scope.id);

// New expectation (after fix):
expect(class_def.scope_id).toBe(file_scope.id);
```

### 3. Fix Test Expectations (60-90 min)

For tests checking `scope_id` values:

**Example Fix 1: File-level class**
```typescript
// BEFORE (test might have been checking wrong scope):
it("class definition", () => {
  // ...
  const class_def = find_class(index, "MyClass");
  expect(class_def.scope_id).toBe(index.root_scope_id);
  // This might NOW pass (was failing before fix)
});
```

**Example Fix 2: Nested class**
```typescript
// BEFORE:
it("nested class", () => {
  const outer_class = find_class(index, "Outer");
  const inner_class = find_class(index, "Inner");

  // Old test might have accepted wrong scopes
  expect(inner_class.scope_id).toBe(outer_method_scope.id);
});

// AFTER (if test needs updating):
it("nested class", () => {
  const outer_class = find_class(index, "Outer");
  const inner_class = find_class(index, "Inner");

  // Verify correct scope assignment
  expect(outer_class.scope_id).toBe(file_scope.id);
  expect(inner_class.scope_id).toBe(outer_method_scope.id);
});
```

### 4. Add Regression Tests If Needed (30 min)

If original tests didn't catch the scope bug, add tests:

```typescript
describe("Scope Assignment - JavaScript (regression)", () => {
  it("file-level class has file scope, not method scope", () => {
    const code = `
class MyClass {
  method() { }
}
    `;
    const index = build_semantic_index(/* ... */);
    const class_def = Array.from(index.classes.values()).find(
      c => c.name === "MyClass"
    );

    // This is the fix we made
    expect(class_def.scope_id).toBe(index.root_scope_id);
  });
});
```

### 5. Run Tests Again (10 min)

```bash
npm test -- semantic_index.javascript.test.ts
```

Expected: All tests pass.

### 6. Document Changes (15 min)

Create summary comment in test file or separate file:

```typescript
/**
 * CHANGES FOR TASK 11.112.15 - Scope Assignment Fix
 *
 * Updated test expectations for:
 * - Test X: Changed class scope expectation from method_scope to file_scope
 * - Test Y: Updated nested class scope verification
 * - Added regression test for file-level class scope
 *
 * All changes reflect the fix in task-epic-11.112.7 where `get_defining_scope_id()`
 * now correctly assigns scope_id based on definition location (start position)
 * rather than full body span.
 */
```

## Success Criteria

- ✅ All JavaScript semantic_index tests pass
- ✅ Test expectations updated correctly
- ✅ No false positives (tests passing for wrong reasons)
- ✅ Regression tests added if needed
- ✅ Changes documented

## Outputs

1. All JavaScript semantic_index tests passing
2. Updated test expectations (if any)
3. Documentation of changes made

## Common Issues

### Issue 1: Test was accepting wrong scope
**Solution:** Update expectation to check for correct scope

### Issue 2: Test wasn't checking scope at all
**Solution:** Add scope verification to strengthen test

### Issue 3: Test structure needs refactoring
**Solution:** Refactor to make scope checks clearer

## Next Task

**task-epic-11.112.16** - Verify TypeScript semantic tests
