# Task 104.3.4: Fix semantic_index.javascript.test.ts

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1 hour
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3.3

## Objective

Update JavaScript semantic index integration tests to verify that metadata extraction is working correctly and all tests pass with the new extractor-based system.

## File to Modify

`packages/core/src/index_single_file/semantic_index.javascript.test.ts`

## Current State

Tests verify basic reference extraction but don't check metadata fields:
- `context.*` fields
- `type_info` fields
- `member_access.object_type` fields

After wiring extractors (task 104.3.3), tests may fail due to:
1. Missing assertions for new metadata
2. Changed reference structure
3. Improved accuracy breaking old assumptions

## Implementation Details

### 1. Identify Failing Tests

Run tests to see what breaks:

```bash
cd packages/core
npx vitest run src/index_single_file/semantic_index.javascript.test.ts --reporter=verbose
```

### 2. Add Metadata Assertions

Update method call tests to verify metadata:

```typescript
it("should extract method call with receiver metadata", () => {
  const code = `
    const obj = new MyClass();
    obj.method();
  `;

  const index = build_semantic_index_from_source(code, "javascript");
  const method_refs = index.references.filter(
    (r) => r.call_type === "method"
  );

  expect(method_refs).toHaveLength(1);

  const method_ref = method_refs[0];
  expect(method_ref.name).toBe("method");

  // NEW: Verify metadata extraction
  expect(method_ref.context?.receiver_location).toBeDefined();
  expect(method_ref.context?.receiver_location?.start_line).toBe(3); // Line with 'obj'

  // NEW: Verify member_access metadata
  expect(method_ref.member_access).toBeDefined();
  expect(method_ref.member_access?.access_type).toBe("method");
});
```

### 3. Add Property Chain Tests

Add tests for property chain extraction:

```typescript
describe("property chain extraction", () => {
  it("should extract simple property access chain", () => {
    const code = "const value = obj.prop;";

    const index = build_semantic_index_from_source(code, "javascript");
    const property_refs = index.references.filter(
      (r) => r.type === "member_access"
    );

    expect(property_refs).toHaveLength(1);
    expect(property_refs[0].context?.property_chain).toEqual(["obj", "prop"]);
  });

  it("should extract chained property access", () => {
    const code = "const value = a.b.c.d;";

    const index = build_semantic_index_from_source(code, "javascript");
    const property_refs = index.references.filter(
      (r) => r.type === "member_access"
    );

    // Should capture the full chain
    const full_chain_ref = property_refs.find(
      (r) => r.context?.property_chain?.length === 4
    );
    expect(full_chain_ref).toBeDefined();
    expect(full_chain_ref?.context?.property_chain).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("should extract chained method calls", () => {
    const code = "obj.first().second().third();";

    const index = build_semantic_index_from_source(code, "javascript");
    const method_refs = index.references.filter(
      (r) => r.call_type === "method"
    );

    expect(method_refs.length).toBeGreaterThanOrEqual(3);

    // Each method call should have receiver location
    for (const ref of method_refs) {
      expect(ref.context?.receiver_location).toBeDefined();
    }
  });
});
```

### 4. Add Assignment Tests

Add tests for assignment metadata:

```typescript
describe("assignment metadata extraction", () => {
  it("should extract assignment source and target", () => {
    const code = "const target = source;";

    const index = build_semantic_index_from_source(code, "javascript");
    const assignments = index.references.filter((r) => r.type === "assignment");

    if (assignments.length > 0) {
      const assignment = assignments[0];
      expect(assignment.context?.assignment_source).toBeDefined();
      expect(assignment.context?.assignment_target).toBeDefined();
    }
  });

  it("should extract constructor target", () => {
    const code = "const obj = new MyClass();";

    const index = build_semantic_index_from_source(code, "javascript");
    const constructor_refs = index.references.filter(
      (r) => r.call_type === "constructor"
    );

    expect(constructor_refs).toHaveLength(1);
    expect(constructor_refs[0].context?.construct_target).toBeDefined();
  });
});
```

### 5. Update Existing Tests

Review existing tests and update assertions:

**Before:**
```typescript
expect(method_ref.member_access).toBeDefined();
// No check for object_type
```

**After:**
```typescript
expect(method_ref.member_access).toBeDefined();
// Now object_type may be populated
if (method_ref.member_access?.object_type) {
  expect(method_ref.member_access.object_type.type_name).toBeTruthy();
}
```

### 6. Handle Undefined Metadata Gracefully

Some metadata may still be undefined for complex cases:
- Computed properties: `obj[key]`
- Dynamic method calls
- Complex destructuring

Update tests to handle optional metadata:

```typescript
it("should handle computed properties", () => {
  const code = "const value = obj[key];";

  const index = build_semantic_index_from_source(code, "javascript");

  // Should not extract property chain for computed access
  const refs = index.references.filter((r) => r.type === "member_access");
  if (refs.length > 0) {
    expect(refs[0].context?.property_chain).toBeUndefined();
  }
});
```

### 7. Fix Snapshot Tests

If tests use snapshots, update them:

```bash
npx vitest run src/index_single_file/semantic_index.javascript.test.ts -u
```

Review snapshot changes to ensure metadata is correctly captured.

## Implementation Steps

1. Run tests to identify failures
2. Add metadata assertions to method call tests
3. Add property chain extraction tests
4. Add assignment metadata tests
5. Update existing test assertions
6. Add tests for edge cases (computed properties, etc.)
7. Update snapshots if needed
8. Run tests until all pass
9. Verify test coverage is maintained

## Running Tests

```bash
cd packages/core
npx vitest run src/index_single_file/semantic_index.javascript.test.ts
```

For watch mode during development:
```bash
npx vitest src/index_single_file/semantic_index.javascript.test.ts
```

## Success Criteria

- ✅ All tests pass
- ✅ Tests verify `context.receiver_location` for method calls
- ✅ Tests verify `context.property_chain` for property access
- ✅ Tests verify `context.assignment_source/target` for assignments
- ✅ Tests verify `context.construct_target` for constructors
- ✅ Tests handle optional metadata gracefully
- ✅ No regressions in existing test coverage
- ✅ Test coverage remains >90%

## Notes

### Expected Improvements

With metadata extraction, expect:
1. More complete reference information
2. Better method call tracking
3. Improved property chain visibility
4. Enhanced assignment tracking

### Test Philosophy

- Test metadata when it should be present
- Don't require metadata for complex/edge cases
- Use optional chaining for metadata assertions: `ref.context?.receiver_location`
- Document why metadata might be absent

### Common Failures

1. **Location mismatches**: Extractors may return slightly different locations
   - Fix: Update expected locations in tests
2. **Missing metadata**: Some patterns may not extract metadata yet
   - Fix: Mark as optional or improve extractor
3. **Extra references**: Better detection may find more references
   - Fix: Update expected counts

## Related Files

- `packages/core/src/index_single_file/semantic_index.ts` (wired in 104.3.3)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts` (implementation)
- `packages/core/src/index_single_file/semantic_index.typescript.test.ts` (will fix in 104.3.5)
