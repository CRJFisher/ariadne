# Task 11.106.8.2: TypeScript - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 20 minutes
**Parent:** task-epic-11.106.8
**Dependencies:** task-epic-11.106.7 (optional chain implemented)

## Objective

Update `semantic_index.typescript.test.ts` to comprehensively test the simplified `SymbolReference` structure with updated reference object attributes.

## File to Update

- `packages/core/src/index_single_file/semantic_index.typescript.test.ts`

## Changes Required

### 1. Remove Deleted Field Assertions

Delete all test assertions on fields that no longer exist:
- `source_type`
- `is_narrowing`
- `is_widening`
- `containing_function`

**Example:**
```typescript
// ❌ DELETE these assertions
expect(ref.type_flow?.source_type).toBeUndefined();
expect(ref.type_flow?.is_narrowing).toBe(false);
expect(ref.context?.containing_function).toBeDefined();
```

### 2. Update type_flow.target_type → assignment_type

Replace all nested `type_flow.target_type` references with direct `assignment_type`:

```typescript
// OLD
expect(ref.type_flow?.target_type?.type_name).toBe("string");

// NEW
expect(ref.assignment_type?.type_name).toBe("string");
```

### 3. Add Comprehensive Optional Chain Tests

Add test cases for TypeScript's optional chaining operator:

```typescript
describe("SymbolReference - optional chaining", () => {
  it("detects optional method call", () => {
    const code = `
      obj?.method()
    `;
    const { references } = index_single_file(code, "test.ts");
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(true);
  });

  it("detects regular method call as non-optional", () => {
    const code = `
      obj.method()
    `;
    const { references } = index_single_file(code, "test.ts");
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("detects optional property access", () => {
    const code = `
      const value = obj?.prop
    `;
    const { references } = index_single_file(code, "test.ts");
    const propRef = references.find(r => r.name === "prop");

    expect(propRef?.member_access?.is_optional_chain).toBe(true);
  });

  it("detects chained optional property access", () => {
    const code = `
      const value = obj?.prop?.nested
    `;
    const { references } = index_single_file(code, "test.ts");
    const nestedRef = references.find(r => r.name === "nested");

    expect(nestedRef?.member_access?.is_optional_chain).toBe(true);
  });

  it("detects mixed optional and regular chaining", () => {
    const code = `
      const value = obj?.prop.nested
    `;
    const { references } = index_single_file(code, "test.ts");
    const nestedRef = references.find(r => r.name === "nested");

    // nested uses regular access, but obj?.prop is optional
    expect(nestedRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("detects optional call with type assertion", () => {
    const code = `
      (obj as SomeType)?.method()
    `;
    const { references } = index_single_file(code, "test.ts");
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(true);
  });
});
```

### 4. Add Comprehensive assignment_type Tests

Add test cases for the `assignment_type` field with TypeScript type annotations:

```typescript
describe("SymbolReference - assignment_type", () => {
  it("captures assignment type annotation for variable", () => {
    const code = `
      const x: string = getValue()
    `;
    const { references } = index_single_file(code, "test.ts");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toBe("string");
  });

  it("captures assignment type for function parameter", () => {
    const code = `
      function test(param: number) {
        const x = param
      }
    `;
    const { references } = index_single_file(code, "test.ts");
    const paramRef = references.find(r => r.name === "param" && r.type === "assignment");

    expect(paramRef?.assignment_type).toBeDefined();
    expect(paramRef?.assignment_type?.type_name).toBe("number");
  });

  it("captures complex type annotation", () => {
    const code = `
      const x: Array<string> = getArray()
    `;
    const { references } = index_single_file(code, "test.ts");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toContain("Array");
  });

  it("does not populate assignment_type for non-assignments", () => {
    const code = `
      function getValue(): string { return "test"; }
      getValue()
    `;
    const { references } = index_single_file(code, "test.ts");
    const callRef = references.find(r => r.name === "getValue" && r.call_type === "function");

    expect(callRef?.assignment_type).toBeUndefined();
  });

  it("does not populate assignment_type for assignments without type", () => {
    const code = `
      const x = getValue()
    `;
    const { references } = index_single_file(code, "test.ts");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeUndefined();
  });
});
```

### 5. Update Existing Integration Tests

Review and update all existing test cases to:
- Use `assignment_type` instead of `type_flow.target_type`
- Remove any checks on deleted fields
- Ensure assertions match the new simplified structure

## Search Commands

```bash
# Find all type_flow references in the file
rg "type_flow" packages/core/src/index_single_file/semantic_index.typescript.test.ts

# Find references to deleted fields
rg "source_type|is_narrowing|is_widening|containing_function" packages/core/src/index_single_file/semantic_index.typescript.test.ts
```

## Verification

Run the test file to ensure all tests pass:

```bash
npx vitest semantic_index.typescript.test.ts
```

Expected: All tests pass with no regressions.

## Success Criteria

- ✅ All references to deleted fields removed from tests
- ✅ `type_flow.target_type` replaced with `assignment_type` throughout
- ✅ Comprehensive optional chaining tests added (6+ test cases)
- ✅ Comprehensive assignment_type tests added (5+ test cases)
- ✅ All existing tests updated to new structure
- ✅ All tests pass (zero new failures)
- ✅ No test regressions from previous run

## Notes

TypeScript has both optional chaining (`?.`) and rich type annotation support, so this file should have comprehensive tests for both:
- Optional chaining patterns (similar to JavaScript but with TypeScript-specific constructs)
- Type annotations on variables, parameters, and return types
- Complex types (generics, unions, intersections)
