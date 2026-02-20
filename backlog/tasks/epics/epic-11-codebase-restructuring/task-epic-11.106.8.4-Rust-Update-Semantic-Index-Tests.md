# Task 11.106.8.4: Rust - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 15 minutes
**Parent:** task-epic-11.106.8
**Dependencies:** task-epic-11.106.7 (optional chain implemented)

## Objective

Update `semantic_index.rust.test.ts` to comprehensively test the simplified `SymbolReference` structure with updated reference object attributes.

## File to Update

- `packages/core/src/index_single_file/semantic_index.rust.test.ts`

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
expect(ref.type_flow?.target_type?.type_name).toBe("String");

// NEW
expect(ref.assignment_type?.type_name).toBe("String");
```

### 3. Add Optional Chain Verification Tests

Rust does NOT support optional chaining (uses `Option` and pattern matching instead). Add test cases to verify `is_optional_chain` is always `false`:

```typescript
describe("SymbolReference - optional chaining (Rust)", () => {
  it("returns false for regular method call", () => {
    const code = `
fn test() {
    obj.method();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("returns false for regular field access", () => {
    const code = `
fn test() {
    let value = obj.field;
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const fieldRef = references.find(r => r.name === "field");

    expect(fieldRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("returns false for chained field access", () => {
    const code = `
fn test() {
    let value = obj.field.nested;
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const nestedRef = references.find(r => r.name === "nested");

    expect(nestedRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("returns false for Option method calls", () => {
    const code = `
fn test() {
    let result = opt.unwrap();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const unwrapRef = references.find(r => r.name === "unwrap");

    // Even though this is Option-related, it's not optional chaining syntax
    expect(unwrapRef?.member_access?.is_optional_chain).toBe(false);
  });
});
```

### 4. Add Comprehensive assignment_type Tests

Add test cases for the `assignment_type` field with Rust type annotations:

```typescript
describe("SymbolReference - assignment_type", () => {
  it("captures assignment type annotation for variable", () => {
    const code = `
fn test() {
    let x: String = get_value();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toBe("String");
  });

  it("captures assignment type for function parameter", () => {
    const code = `
fn test(param: i32) {
    let x = param;
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const paramRef = references.find(r => r.name === "param" && r.type === "assignment");

    expect(paramRef?.assignment_type).toBeDefined();
    expect(paramRef?.assignment_type?.type_name).toBe("i32");
  });

  it("captures complex type annotation", () => {
    const code = `
fn test() {
    let x: Vec<String> = get_vec();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toContain("Vec");
  });

  it("captures reference type annotation", () => {
    const code = `
fn test() {
    let x: &str = get_str();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toContain("str");
  });

  it("does not populate assignment_type for non-assignments", () => {
    const code = `
fn get_value() -> String {
    String::from("test")
}

fn test() {
    get_value();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const callRef = references.find(r => r.name === "get_value" && r.call_type === "function");

    expect(callRef?.assignment_type).toBeUndefined();
  });

  it("does not populate assignment_type for assignments with type inference", () => {
    const code = `
fn test() {
    let x = get_value();
}
    `;
    const { references } = index_single_file(code, "test.rs");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    // Type is inferred, not explicitly annotated
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
rg "type_flow" packages/core/src/index_single_file/semantic_index.rust.test.ts

# Find references to deleted fields
rg "source_type|is_narrowing|is_widening|containing_function" packages/core/src/index_single_file/semantic_index.rust.test.ts
```

## Verification

Run the test file to ensure all tests pass:

```bash
npx vitest semantic_index.rust.test.ts
```

Expected: All tests pass with no regressions.

## Success Criteria

- ✅ All references to deleted fields removed from tests
- ✅ `type_flow.target_type` replaced with `assignment_type` throughout
- ✅ Optional chaining verification tests added (4 test cases confirming false)
- ✅ Comprehensive assignment_type tests added (6+ test cases)
- ✅ All existing tests updated to new structure
- ✅ All tests pass (zero new failures)
- ✅ No test regressions from previous run

## Notes

Rust does NOT support optional chaining syntax (it uses `Option<T>` types with pattern matching instead), so all `is_optional_chain` checks should return `false`. The tests should verify this behavior, including for Option-related method calls like `.unwrap()`.

Rust DOES have explicit type annotations, so comprehensive tests for `assignment_type` are important:
- Variable type annotations: `let x: Type = value`
- Parameter type annotations: `fn func(param: Type)`
- Return type annotations: `fn func() -> Type`
- Complex types: `Vec<T>`, `Option<T>`, `Result<T, E>`, etc.
- Reference types: `&str`, `&mut T`, etc.
- Note: Type inference (`let x = value`) should NOT populate `assignment_type`
