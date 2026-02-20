# Task 104.3.5: Fix semantic_index.typescript.test.ts

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 45 minutes
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3.4

## Objective

Update TypeScript semantic index integration tests to verify metadata extraction works with TypeScript-specific features (type annotations, generics, interfaces).

## File to Modify

`packages/core/src/index_single_file/semantic_index.typescript.test.ts`

## Scope

Similar to 104.3.4 but focused on TypeScript-specific features:
- Type annotations: `const x: string = "hello"`
- Generic types: `Array<T>`, `Map<K, V>`
- Interface type references
- Type parameters in function signatures
- Return type annotations

## Implementation Details

### 1. Add Type Annotation Tests

```typescript
describe("type annotation metadata", () => {
  it("should extract type info from variable annotation", () => {
    const code = "const name: string = 'Alice';";

    const index = build_semantic_index_from_source(code, "typescript");
    const refs = index.references.filter((r) => r.type_info);

    // Should find type annotation reference
    const type_ref = refs.find((r) => r.type_info?.type_name === "string");
    expect(type_ref).toBeDefined();
    expect(type_ref?.type_info?.certainty).toBe("declared");
  });

  it("should extract generic type arguments", () => {
    const code = "const items: Array<string> = [];";

    const index = build_semantic_index_from_source(code, "typescript");
    const type_refs = index.references.filter((r) => r.type === "type");

    // Should extract both Array and string references
    expect(type_refs.some((r) => r.name === "Array")).toBe(true);
    expect(type_refs.some((r) => r.name === "string")).toBe(true);
  });

  it("should extract function return type", () => {
    const code = "function greet(): string { return 'hello'; }";

    const index = build_semantic_index_from_source(code, "typescript");

    // Function definition should have return_type_hint
    const func_def = Array.from(index.functions.values())[0];
    expect(func_def?.return_type_hint).toBe("string");
  });
});
```

### 2. Add Generic Type Tests

```typescript
describe("generic type metadata", () => {
  it("should extract multiple type arguments", () => {
    const code = "const map: Map<string, number> = new Map();";

    const index = build_semantic_index_from_source(code, "typescript");

    // Should extract Map, string, and number type references
    const type_refs = index.references.filter((r) => r.type === "type");
    expect(type_refs.length).toBeGreaterThanOrEqual(3);
  });

  it("should extract nested generics", () => {
    const code = "const nested: Array<Array<string>> = [];";

    const index = build_semantic_index_from_source(code, "typescript");
    const type_refs = index.references.filter((r) => r.type === "type");

    // Should find multiple Array and string references
    const array_refs = type_refs.filter((r) => r.name === "Array");
    expect(array_refs.length).toBeGreaterThanOrEqual(2);
  });
});
```

### 3. Update Method Call Tests for TypeScript

```typescript
it("should extract method call with typed receiver", () => {
  const code = `
    const service: MyService = getService();
    service.doWork();
  `;

  const index = build_semantic_index_from_source(code, "typescript");
  const method_refs = index.references.filter((r) => r.call_type === "method");

  expect(method_refs).toHaveLength(1);
  expect(method_refs[0].context?.receiver_location).toBeDefined();

  // With TypeScript, may extract type info from annotation
  if (method_refs[0].type_info) {
    expect(method_refs[0].type_info.type_name).toBe("MyService");
  }
});
```

### 4. Add Interface Tests

```typescript
describe("interface type references", () => {
  it("should extract interface type annotations", () => {
    const code = `
      interface Person {
        name: string;
      }
      const user: Person = { name: 'Alice' };
    `;

    const index = build_semantic_index_from_source(code, "typescript");

    // Should find Person interface definition
    expect(index.interfaces.size).toBe(1);

    // Should find Person type reference in variable annotation
    const type_refs = index.references.filter(
      (r) => r.type === "type" && r.name === "Person"
    );
    expect(type_refs.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 5. Follow Pattern from 104.3.4

Apply same fixes as JavaScript tests:
- Add metadata assertions
- Handle optional metadata
- Update snapshots if needed
- Verify no regressions

## Implementation Steps

1. Run tests to identify TypeScript-specific failures
2. Add type annotation metadata tests
3. Add generic type tests
4. Update existing method call tests for TypeScript
5. Add interface type reference tests
6. Update snapshots if needed
7. Run tests until all pass

## Running Tests

```bash
cd packages/core
npx vitest run src/index_single_file/semantic_index.typescript.test.ts
```

## Success Criteria

- ✅ All TypeScript tests pass
- ✅ Tests verify type annotation extraction
- ✅ Tests verify generic type argument extraction
- ✅ Tests verify interface type references
- ✅ Tests verify method calls with typed receivers
- ✅ No regressions in test coverage

## Notes

### TypeScript vs JavaScript

TypeScript tests should verify:
- Type information is extracted from annotations
- Generic type arguments are captured
- Interface references are tracked
- Everything from JavaScript tests still works

### Optional Type Info

Not all references will have `type_info`:
- Plain JavaScript patterns: no type info
- Inferred types: may or may not have type info
- Explicit annotations: should have type info with certainty "declared"

## Related Files

- `packages/core/src/index_single_file/semantic_index.javascript.test.ts` (similar patterns)
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts` (handles both JS and TS)
