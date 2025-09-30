# Task 104.6: Integration and Validation (3 Sub-tasks)

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2.5 hours total
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3, task-epic-11.104.4, task-epic-11.104.5

## Overview

Final integration testing, cleanup, and validation that reference metadata extraction works correctly across all languages and use cases.

## Sub-Tasks

### 104.6.1 - Update reference_builder.test.ts (1 hour)

**File:** `packages/core/src/index_single_file/query_code_tree/reference_builder.test.ts`

**Objective:** Update unit tests for ReferenceBuilder to verify metadata extraction with mocked extractors.

**Implementation:**

1. **Create Mock Extractors**

```typescript
const mock_extractors: MetadataExtractors = {
  extract_type_from_annotation: vi.fn(() => ({
    type_id: "type:string:test.ts:1:0" as TypeId,
    type_name: "string" as SymbolName,
    certainty: "declared" as const,
  })),

  extract_call_receiver: vi.fn(() => ({
    file_path: "/test.ts" as FilePath,
    start_line: 1,
    start_column: 0,
    end_line: 1,
    end_column: 3,
  })),

  extract_property_chain: vi.fn(() => ["obj", "prop"] as SymbolName[]),

  extract_assignment_parts: vi.fn(() => ({
    source: { /* location */ },
    target: { /* location */ },
  })),

  extract_construct_target: vi.fn(() => ({ /* location */ })),

  extract_type_arguments: vi.fn(() => ["string"] as SymbolName[]),
};
```

2. **Update Test Cases**

- Pass `mock_extractors` to `ReferenceBuilder` constructor
- Verify extractors are called with correct arguments
- Verify extracted metadata appears in built references
- Test that `undefined` returns from extractors are handled

3. **Add Metadata Verification Tests**

```typescript
it("should populate context.receiver_location for method calls", () => {
  // Setup capture for method call
  const builder = new ReferenceBuilder(context, mock_extractors);
  builder.process(method_call_capture);
  const refs = builder.build();

  expect(refs[0].context?.receiver_location).toBeDefined();
  expect(mock_extractors.extract_call_receiver).toHaveBeenCalled();
});

it("should handle undefined metadata gracefully", () => {
  const undefined_extractors: MetadataExtractors = {
    extract_type_from_annotation: () => undefined,
    extract_call_receiver: () => undefined,
    extract_property_chain: () => undefined,
    extract_assignment_parts: () => ({ source: undefined, target: undefined }),
    extract_construct_target: () => undefined,
    extract_type_arguments: () => undefined,
  };

  const builder = new ReferenceBuilder(context, undefined_extractors);
  builder.process(capture);
  const refs = builder.build();

  // Should still build valid references with undefined metadata
  expect(refs).toHaveLength(1);
  expect(refs[0].context).toBeUndefined();
  expect(refs[0].type_info).toBeUndefined();
});
```

### 104.6.2 - End-to-End Validation (1 hour)

**Objective:** Run comprehensive end-to-end tests across all languages to verify metadata extraction works in realistic scenarios.

**Implementation:**

1. **Create Validation Test File**

`packages/core/src/index_single_file/metadata_validation.test.ts`

2. **Add Cross-Language Tests**

```typescript
describe("metadata extraction validation", () => {
  describe.each([
    ["javascript", "const obj = {}; obj.method();"],
    ["typescript", "const obj: MyType = {}; obj.method();"],
    ["python", "obj = MyClass()\nobj.method()"],
    ["rust", "let obj = MyStruct::new();\nobj.method();"],
  ])("language: %s", (language, code) => {
    it("should extract method call receiver", () => {
      const index = build_semantic_index_from_source(code, language as Language);
      const method_refs = index.references.filter(r => r.call_type === "method");

      expect(method_refs.length).toBeGreaterThan(0);
      // Most method calls should have receiver location
      const with_receiver = method_refs.filter(r => r.context?.receiver_location);
      expect(with_receiver.length / method_refs.length).toBeGreaterThan(0.8);
    });
  });
});
```

3. **Add Statistics Collection**

```typescript
it("should extract metadata for >80% of method calls across all languages", () => {
  const test_cases = [
    { language: "javascript", files: [...] },
    { language: "typescript", files: [...] },
    { language: "python", files: [...] },
    { language: "rust", files: [...] },
  ];

  const stats = {
    total_method_calls: 0,
    with_receiver: 0,
    with_type_info: 0,
  };

  for (const test_case of test_cases) {
    // Build index and collect stats
  }

  console.log("Metadata extraction statistics:", stats);

  expect(stats.with_receiver / stats.total_method_calls).toBeGreaterThan(0.8);
});
```

4. **Add Regression Tests**

Test known tricky patterns:
- Chained method calls: `a.b().c().d()`
- Nested property access: `obj.prop.nested.deep`
- Generic method calls: `arr.map<string>(x => x)`
- Constructor chaining: `new Builder().with_x().build()`

### 104.6.3 - Cleanup and Documentation (30 minutes)

**Objective:** Remove TODOs, update documentation, and ensure code is production-ready.

**Tasks:**

1. **Remove Stubbed Code Comments**
   - Search for "TODO" in reference_builder.ts - all should be resolved
   - Remove "Would need to extract" comments
   - Remove "STUBBED" comments from REFERENCE_METADATA_PLAN.md

2. **Update REFERENCE_METADATA_PLAN.md**
   - Mark Phase 2 & 3 as ✅ DONE
   - Add "Implementation Complete" section with stats
   - Document any known limitations

3. **Add JSDoc to Key Functions**
   - Ensure all extractor functions have clear documentation
   - Document parameters and return values
   - Add examples where helpful

4. **Update Reference Builder Comments**

Add overview comment to reference_builder.ts:

```typescript
/**
 * Reference Builder System
 *
 * Creates SymbolReference objects from tree-sitter captures with rich metadata.
 * Uses language-specific MetadataExtractors to parse AST structures and extract:
 * - Type information from annotations
 * - Method call receiver locations
 * - Property access chains
 * - Assignment source/target locations
 * - Constructor call targets
 * - Generic type arguments
 *
 * Metadata extraction is essential for accurate method resolution and call-chain
 * detection during symbol resolution phase.
 *
 * @see MetadataExtractors for language-specific implementations
 * @see symbol_resolution.ts for metadata usage
 */
```

5. **Run Full Test Suite**

```bash
cd packages/core
npm test
```

Verify:
- All tests pass
- No TypeScript errors
- Test coverage maintained/improved

6. **Document Metadata Coverage**

Add section to REFERENCE_METADATA_PLAN.md:

```markdown
## Implementation Results (Completed)

### Metadata Extraction Rates

- **Method Calls with Receiver Location:** 85%+
- **Type References with Type Info:** 90%+
- **Property Chains Extracted:** 75%+
- **Assignments with Source/Target:** 70%+

### Known Limitations

- Computed properties (obj[key]) - no property chain
- Complex destructuring - may not extract all parts
- Dynamic method calls - no receiver location
- Type inference - certainty is "inferred" not "declared"

### Performance Impact

- Average overhead: <5ms per file
- No significant impact on build times
- Memory usage: +2% for metadata storage
```

## Success Criteria (All Sub-tasks)

### 104.6.1
- ✅ reference_builder.test.ts updated with mock extractors
- ✅ Tests verify metadata extraction logic
- ✅ Tests handle undefined metadata gracefully
- ✅ All reference_builder tests pass

### 104.6.2
- ✅ End-to-end validation tests created
- ✅ Tests cover all 4 languages
- ✅ Metadata extraction rates measured
- ✅ Success criteria from parent task met:
  - 80%+ method calls have receiver_location
  - 90%+ type references have type_info

### 104.6.3
- ✅ All TODO comments removed
- ✅ REFERENCE_METADATA_PLAN.md updated
- ✅ JSDoc documentation complete
- ✅ Full test suite passes
- ✅ No TypeScript errors
- ✅ Code ready for production

## Related Files

- `packages/core/src/index_single_file/query_code_tree/reference_builder.ts`
- `packages/core/src/index_single_file/query_code_tree/reference_builder.test.ts`
- `REFERENCE_METADATA_PLAN.md`
- All semantic_index.*.test.ts files
