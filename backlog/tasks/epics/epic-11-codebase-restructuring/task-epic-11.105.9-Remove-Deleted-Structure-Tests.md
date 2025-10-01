# Task 105.9: Remove Tests for Deleted Structures

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.105
**Dependencies:** task-epic-11.105.2, task-epic-11.105.3, task-epic-11.105.4

## Objective

Delete test files for removed modules (`type_members`, `type_tracking`, partial `type_flow_references`). Preserve only constructor call tests.

## Files to Delete

### 1. Type Members Tests (15 min)

**Delete:**
```bash
rm packages/core/src/index_single_file/definitions/type_members/type_members.test.ts
```

Already deleted in task 105.2 when the module was removed.

**Verify:**
```bash
ls packages/core/src/index_single_file/definitions/type_members/
# Should not exist
```

### 2. Type Tracking Tests (10 min)

**Delete:**
```bash
rm packages/core/src/index_single_file/references/type_tracking/type_tracking.test.ts
```

Already deleted in task 105.3 when the module was removed.

**Verify:**
```bash
ls packages/core/src/index_single_file/references/type_tracking/
# Should not exist
```

### 3. Type Flow Tests (Partial) (20 min)

**File:** `packages/core/src/index_single_file/references/type_flow_references/type_flow_references.test.ts`

This file has tests for multiple features. Need to:
1. Extract constructor call tests (keep)
2. Delete assignment/return/call_assignment tests (remove)

**Step 1: Check what exists**
```bash
cat packages/core/src/index_single_file/references/type_flow_references/type_flow_references.test.ts | grep "describe"
```

**Step 2: Extract constructor tests**

If constructor tests are in this file, move them to new file:
```bash
# Create new test file
touch packages/core/src/index_single_file/references/constructor_calls/constructor_calls.test.ts
```

Copy only constructor-related tests to new file.

**Step 3: Delete old file**
```bash
rm packages/core/src/index_single_file/references/type_flow_references/type_flow_references.test.ts
```

**Step 4: Or if file already moved**

If type_flow_references was already deleted in task 105.6:
```bash
ls packages/core/src/index_single_file/references/type_flow_references/
# Should not exist or only have minimal code
```

## Constructor Call Tests

### Ensure Tests Exist

**File:** `packages/core/src/index_single_file/references/constructor_calls/constructor_calls.test.ts`

Should test:
```typescript
describe('extract_constructor_calls', () => {
  it('extracts constructor with assignment', () => {
    const code = 'const user = new User();';
    const calls = extract_constructor_calls(captures, scopes);

    expect(calls).toHaveLength(1);
    expect(calls[0].class_name).toBe('User');
    expect(calls[0].assigned_to).toBe('user');
  });

  it('extracts constructor without assignment', () => {
    const code = 'new User();';
    const calls = extract_constructor_calls(captures, scopes);

    expect(calls).toHaveLength(1);
    expect(calls[0].assigned_to).toBeUndefined();
  });

  it('extracts constructor with arguments', () => {
    const code = 'new User(name, age);';
    const calls = extract_constructor_calls(captures, scopes);

    expect(calls[0].argument_count).toBe(2);
  });

  it('tracks scope for constructor calls', () => {
    const code = 'function foo() { const x = new User(); }';
    const calls = extract_constructor_calls(captures, scopes);

    expect(calls[0].scope_id).toBeDefined();
  });
});
```

If these tests don't exist yet, create them (moved from type_flow tests).

## Cleanup Enhanced Context Tests

### Check Enhanced Context Test Files (10 min)

```bash
ls packages/core/src/resolve_references/method_resolution_simple/*enhanced*.test.ts
```

**Files that may exist:**
- `enhanced_context.test.ts`
- `enhanced_method_resolution.test.ts`
- `enhanced_heuristic_resolver.test.ts`

**For each file:**

**If enhanced_* code was deleted:**
```bash
# Delete the test file too
rm packages/core/src/resolve_references/method_resolution_simple/enhanced_*.test.ts
```

**If enhanced_* code still exists (deprecated):**

Update tests to handle missing fields:
```typescript
// Update mocks to not include deleted fields
const mock_index: SemanticIndex = {
  // ... required fields ...
  type_annotations: [],
  constructor_calls: [],
  // ❌ Don't include deleted fields
};
```

## Validation

### 1. No Orphaned Test Files
```bash
# Find test files without corresponding source files
find packages/core/src -name "*.test.ts" | while read test_file; do
  source_file="${test_file%.test.ts}.ts"
  if [ ! -f "$source_file" ]; then
    echo "Orphaned test: $test_file"
  fi
done
```

Should find no orphans.

### 2. All Tests Pass
```bash
npm test
```

### 3. Test Coverage Maintained
```bash
npm run test:coverage

# Coverage should be maintained or improved
# We removed untested code, so % should increase
```

### 4. No References to Deleted Modules
```bash
# Should find NO results
grep -r "type_members\|type_tracking" packages/core/src --include="*.test.ts"
grep -r "from.*type_members\|from.*type_tracking" packages/core/src --include="*.ts"
```

## Deliverables

- [ ] `type_members.test.ts` deleted (already done in 105.2)
- [ ] `type_tracking.test.ts` deleted (already done in 105.3)
- [ ] `type_flow_references.test.ts` deleted or updated
- [ ] Constructor call tests preserved in new location
- [ ] Enhanced context tests updated or deleted
- [ ] All remaining tests pass
- [ ] No orphaned test files
- [ ] Test coverage maintained

## Test Migration Checklist

For each deleted test file, ensure:
- [ ] Tests were either obsolete (testing deleted feature) or
- [ ] Tests were migrated to test the new structure or
- [ ] Functionality is covered by other tests

## Next Steps

- Task 105.10: Update documentation and examples
