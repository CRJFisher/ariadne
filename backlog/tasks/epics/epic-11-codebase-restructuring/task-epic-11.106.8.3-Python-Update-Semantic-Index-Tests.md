# Task 11.106.8.3: Python - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 15 minutes
**Parent:** task-epic-11.106.8
**Dependencies:** task-epic-11.106.7 (optional chain implemented)

## Objective

Update `semantic_index.python.test.ts` to comprehensively test the simplified `SymbolReference` structure with updated reference object attributes.

## File to Update

- `packages/core/src/index_single_file/semantic_index.python.test.ts`

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
expect(ref.type_flow?.target_type?.type_name).toBe("str");

// NEW
expect(ref.assignment_type?.type_name).toBe("str");
```

### 3. Add Optional Chain Verification Tests

Python does NOT support optional chaining. Add test cases to verify `is_optional_chain` is always `false`:

```typescript
describe("SymbolReference - optional chaining (Python)", () => {
  it("returns false for regular method call", () => {
    const code = `
obj.method()
    `;
    const { references } = index_single_file(code, "test.py");
    const methodRef = references.find(r => r.name === "method");

    expect(methodRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("returns false for regular property access", () => {
    const code = `
value = obj.prop
    `;
    const { references } = index_single_file(code, "test.py");
    const propRef = references.find(r => r.name === "prop");

    expect(propRef?.member_access?.is_optional_chain).toBe(false);
  });

  it("returns false for chained property access", () => {
    const code = `
value = obj.prop.nested
    `;
    const { references } = index_single_file(code, "test.py");
    const nestedRef = references.find(r => r.name === "nested");

    expect(nestedRef?.member_access?.is_optional_chain).toBe(false);
  });
});
```

### 4. Add Comprehensive assignment_type Tests

Add test cases for the `assignment_type` field with Python type hints:

```typescript
describe("SymbolReference - assignment_type", () => {
  it("captures assignment type hint for variable", () => {
    const code = `
x: str = get_value()
    `;
    const { references } = index_single_file(code, "test.py");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toBe("str");
  });

  it("captures assignment type hint for function parameter", () => {
    const code = `
def test(param: int):
    x = param
    `;
    const { references } = index_single_file(code, "test.py");
    const paramRef = references.find(r => r.name === "param" && r.type === "assignment");

    expect(paramRef?.assignment_type).toBeDefined();
    expect(paramRef?.assignment_type?.type_name).toBe("int");
  });

  it("captures complex type hint", () => {
    const code = `
from typing import List
x: List[str] = get_list()
    `;
    const { references } = index_single_file(code, "test.py");
    const assignRef = references.find(r => r.name === "x" && r.type === "assignment");

    expect(assignRef?.assignment_type).toBeDefined();
    expect(assignRef?.assignment_type?.type_name).toContain("List");
  });

  it("does not populate assignment_type for non-assignments", () => {
    const code = `
def get_value() -> str:
    return "test"

get_value()
    `;
    const { references } = index_single_file(code, "test.py");
    const callRef = references.find(r => r.name === "get_value" && r.call_type === "function");

    expect(callRef?.assignment_type).toBeUndefined();
  });

  it("does not populate assignment_type for assignments without type hint", () => {
    const code = `
x = get_value()
    `;
    const { references } = index_single_file(code, "test.py");
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
rg "type_flow" packages/core/src/index_single_file/semantic_index.python.test.ts

# Find references to deleted fields
rg "source_type|is_narrowing|is_widening|containing_function" packages/core/src/index_single_file/semantic_index.python.test.ts
```

## Verification

Run the test file to ensure all tests pass:

```bash
npx vitest semantic_index.python.test.ts
```

Expected: All tests pass with no regressions.

## Success Criteria

- ✅ All references to deleted fields removed from tests
- ✅ `type_flow.target_type` replaced with `assignment_type` throughout
- ✅ Optional chaining verification tests added (3 test cases confirming false)
- ✅ Comprehensive assignment_type tests added (5+ test cases)
- ✅ All existing tests updated to new structure
- ✅ All tests pass (zero new failures)
- ✅ No test regressions from previous run

## Notes

Python does NOT support optional chaining syntax, so all `is_optional_chain` checks should return `false`. The tests should verify this behavior rather than test optional chaining patterns.

Python DOES support type hints (PEP 484+), so comprehensive tests for `assignment_type` are important:
- Type hints on variables: `x: str = value`
- Type hints on parameters: `def func(param: int)`
- Type hints on return types: `def func() -> str`
- Complex types from `typing` module: `List[str]`, `Dict[str, int]`, etc.
