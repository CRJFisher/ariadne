# Task 11.108.6: JavaScript - Update Semantic Index Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.108
**Dependencies:** task-epic-11.108.2 (JavaScript processing complete)

## Objective

Update JavaScript semantic_index tests to use complete literal object assertions that verify all data returned by the builder, including nested objects like parameters, properties, and methods.

## Current Test Issues

Current tests likely use partial assertions or missing checks:
- May not verify nested objects (parameters, methods, properties)
- May use `toBeDefined()` instead of complete object equality
- May not check all fields are populated correctly
- May miss edge cases

## Required Changes

### Test Structure Pattern

**Current (insufficient):**
```typescript
it("extracts classes", () => {
  const code = `class MyClass {}`;
  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.name === "MyClass"
  );

  expect(class_def).toBeDefined();  // ❌ Not enough!
});
```

**Required (complete):**
```typescript
it("extracts classes with complete structure", () => {
  const code = `class MyClass {}`;
  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.name === "MyClass"
  );

  expect(class_def).toEqual({  // ✅ Full object equality
    kind: "class",
    symbol_id: expect.stringMatching(/^class:/),
    name: "MyClass",
    location: {
      file_path: "test.js",
      start_line: expect.any(Number),
      start_column: expect.any(Number),
      end_line: expect.any(Number),
      end_column: expect.any(Number),
    },
    scope_id: expect.any(String),
    availability: { scope: "file-private" },
    methods: new Map(),
    properties: new Map(),
    extends: [],
    constructor: undefined,
  });
});
```

## Test Cases Required

### 1. Classes

**Test:** Class with constructor, methods, and properties
```typescript
it("extracts class with all members", () => {
  const code = `
    class MyClass {
      x = 10;
      y;

      constructor(a, b) {
        this.a = a;
        this.b = b;
      }

      method1(p1, p2 = 5) {
        return p1 + p2;
      }

      method2() {}
    }
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");
  const class_def = Array.from(result.definitions.values()).find(
    (d) => d.kind === "class" && d.name === "MyClass"
  );

  expect(class_def).toBeDefined();
  expect(class_def?.constructor).toBeDefined();
  expect(class_def?.constructor?.parameters).toHaveLength(2);
  expect(class_def?.constructor?.parameters[0].name).toBe("a");
  expect(class_def?.constructor?.parameters[1].name).toBe("b");

  expect(class_def?.methods?.size).toBe(2);
  const method1 = Array.from(class_def?.methods?.values() || []).find(
    (m) => m.name === "method1"
  );
  expect(method1?.parameters).toHaveLength(2);
  expect(method1?.parameters[0].name).toBe("p1");
  expect(method1?.parameters[1].name).toBe("p2");
  expect(method1?.parameters[1].default_value).toBe("5");

  expect(class_def?.properties?.size).toBe(2);
  const x_prop = Array.from(class_def?.properties?.values() || []).find(
    (p) => p.name === "x"
  );
  expect(x_prop?.initial_value).toBe("10");
});
```

### 2. Functions

**Test:** Functions with various parameter types
```typescript
it("extracts functions with parameters", () => {
  const code = `
    function add(x, y) {
      return x + y;
    }

    function greet(name = "World") {
      console.log("Hello " + name);
    }
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const add_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "add"
  );
  expect(add_func?.parameters).toHaveLength(2);
  expect(add_func?.parameters[0].name).toBe("x");
  expect(add_func?.parameters[1].name).toBe("y");

  const greet_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "greet"
  );
  expect(greet_func?.parameters).toHaveLength(1);
  expect(greet_func?.parameters[0].name).toBe("name");
  expect(greet_func?.parameters[0].default_value).toBe('"World"');
});
```

### 3. Arrow Functions

**Test:** Arrow functions as variables
```typescript
it("extracts arrow functions", () => {
  const code = `
    const multiply = (a, b) => a * b;
    const square = x => x * x;
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const multiply_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "multiply"
  );
  expect(multiply_func?.parameters).toHaveLength(2);

  const square_func = Array.from(result.definitions.values()).find(
    (d) => d.kind === "function" && d.name === "square"
  );
  expect(square_func?.parameters).toHaveLength(1);
  expect(square_func?.parameters[0].name).toBe("x");
});
```

### 4. Variables and Constants

**Test:** Variable declarations
```typescript
it("extracts variables and constants", () => {
  const code = `
    let x = 10;
    var y = "hello";
    const PI = 3.14;
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const x_var = Array.from(result.definitions.values()).find(
    (d) => d.kind === "variable" && d.name === "x"
  );
  expect(x_var?.initial_value).toBe("10");

  const pi_const = Array.from(result.definitions.values()).find(
    (d) => d.kind === "constant" && d.name === "PI"
  );
  expect(pi_const?.initial_value).toBe("3.14");
});
```

### 5. Imports

**Test:** All import types
```typescript
it("extracts imports", () => {
  const code = `
    import defaultExport from './module1';
    import { named1, named2 } from './module2';
    import * as namespace from './module3';
    import { original as alias } from './module4';
  `;

  const result = index_single_file(code, "test.js" as FilePath, "javascript");

  const imports = Array.from(result.definitions.values()).filter(
    (d) => d.kind === "import"
  );

  expect(imports.length).toBeGreaterThanOrEqual(4);

  const default_import = imports.find((i) => i.name === "defaultExport");
  expect(default_import?.import_kind).toBe("default");
  expect(default_import?.import_path).toBe("./module1");

  const named_import = imports.find((i) => i.name === "named1");
  expect(named_import?.import_kind).toBe("named");

  const namespace_import = imports.find((i) => i.name === "namespace");
  expect(namespace_import?.import_kind).toBe("namespace");

  const alias_import = imports.find((i) => i.name === "alias");
  expect(alias_import?.import_kind).toBe("named");
  expect(alias_import?.original_name).toBe("original");
});
```

## Coverage Checklist

Test must cover ALL definition types:

- [ ] Class definitions
- [ ] Class with constructor
- [ ] Constructor parameters
- [ ] Methods in classes
- [ ] Method parameters (with and without defaults)
- [ ] Properties in classes
- [ ] Function declarations
- [ ] Function parameters
- [ ] Arrow functions
- [ ] Variables (let, var)
- [ ] Constants (const)
- [ ] Import default
- [ ] Import named
- [ ] Import namespace
- [ ] Import aliased

## Nested Object Verification

For each test, verify nested objects exist and are complete:

```typescript
// ✅ Good - checks nested structure
expect(class_def?.constructor?.parameters).toHaveLength(2);
expect(class_def?.constructor?.parameters[0]).toEqual({
  symbol_id: expect.any(String),
  name: "x",
  location: expect.objectContaining({
    file_path: "test.js",
  }),
  scope_id: expect.any(String),
  type: undefined, // JavaScript doesn't have types
  default_value: undefined,
});

// ❌ Bad - only checks existence
expect(class_def?.constructor).toBeDefined();
```

## File to Update

**File:** `packages/core/src/index_single_file/semantic_index.javascript.test.ts`

## Implementation Steps

1. **Review existing tests** - identify gaps
2. **Add missing test cases** - ensure all definition types covered
3. **Convert partial assertions to complete** - use `toEqual()` with full objects
4. **Verify nested objects** - check parameters, methods, properties
5. **Run tests** - ensure all pass
6. **Check coverage** - aim for 100% of definition types

## Verification

```bash
# Run tests
npm test -- semantic_index.javascript.test.ts

# Check coverage
npm test -- semantic_index.javascript.test.ts --coverage

# Verify all definition types tested
grep -E "it\(|describe\(" packages/core/src/index_single_file/semantic_index.javascript.test.ts
```

## Success Criteria

- ✅ All definition types have tests
- ✅ All tests use `toEqual()` with complete object structures
- ✅ Nested objects (parameters, methods, properties) verified
- ✅ All tests pass
- ✅ No false positives (tests actually check the data)

## Related Files

- [semantic_index.javascript.test.ts](../../../packages/core/src/index_single_file/semantic_index.javascript.test.ts)
- [javascript_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder.ts)

## Notes

Good tests are documentation. These tests should make it obvious what the semantic index extracts from JavaScript code. Use realistic code examples and verify the complete structure, not just "it doesn't crash".
