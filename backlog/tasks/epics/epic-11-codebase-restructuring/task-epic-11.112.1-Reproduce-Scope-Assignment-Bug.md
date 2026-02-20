# Task epic-11.112.1: Reproduce Scope Assignment Bug

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** 1 new test file

## Objective

Create failing tests that demonstrate the scope assignment bug where class/interface/enum definitions receive incorrect `scope_id` values (pointing to nested method scopes instead of their declaring scope).

## Files to Create

- `packages/core/src/index_single_file/scope_assignment_bug_repro.test.ts`

## Implementation Steps

### 1. Create Test File Skeleton (15 min)

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { build_semantic_index } from "./semantic_index";
import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import type { FilePath } from "@ariadnejs/types";
import type { ParsedFile } from "./file_utils";

describe("Scope Assignment Bug Reproduction - Issue #111", () => {
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript.typescript);
  });

  function create_parsed_file(
    code: string,
    file_path: FilePath,
    tree: Parser.Tree
  ): ParsedFile {
    const lines = code.split("\n");
    return {
      file_path,
      file_lines: lines.length,
      file_end_column: lines[lines.length - 1]?.length || 0,
      tree,
      lang: "typescript",
    };
  }
});
```

### 2. Add File-Level Class Test (30 min)

Demonstrates the primary bug:

```typescript
it("BUG: file-level class has scope_id pointing to method scope", () => {
  const code = `
class MyClass {
  method() {
    const x = 1;
  }
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.ts" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "typescript");

  const class_def = Array.from(index.classes.values()).find(
    (c) => c.name === "MyClass"
  );
  const method_scope = Array.from(index.scopes.values()).find(
    (s) => s.name === "method"
  );

  expect(class_def).toBeDefined();
  expect(method_scope).toBeDefined();

  console.log("\n=== BUG EVIDENCE ===");
  console.log("Class scope_id:", class_def!.scope_id);
  console.log("Method scope_id:", method_scope!.id);
  console.log("File root scope_id:", index.root_scope_id);
  console.log(
    "BUG:",
    class_def!.scope_id === method_scope!.id ? "CLASS POINTS TO METHOD SCOPE ❌" : "OK"
  );

  // EXPECTED: Class should be in file scope
  expect(class_def!.scope_id).toBe(index.root_scope_id);

  // This test WILL FAIL - that's the bug we're reproducing
});
```

### 3. Add Nested Class Test (30 min)

```typescript
it("BUG: nested class scope assignment points to deepest method", () => {
  const code = `
class Outer {
  outerMethod() {
    class Inner {
      innerMethod() {
        const y = 2;
      }
    }
  }
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.ts" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "typescript");

  const outer_class = Array.from(index.classes.values()).find(
    (c) => c.name === "Outer"
  );
  const inner_class = Array.from(index.classes.values()).find(
    (c) => c.name === "Inner"
  );
  const outer_method = Array.from(index.scopes.values()).find(
    (s) => s.name === "outerMethod"
  );

  console.log("\n=== NESTED CLASS BUG ===");
  console.log("Outer class scope_id:", outer_class!.scope_id);
  console.log("Inner class scope_id:", inner_class!.scope_id);
  console.log("Outer method scope_id:", outer_method!.id);
  console.log("File scope_id:", index.root_scope_id);

  // EXPECTED:
  expect(outer_class!.scope_id).toBe(index.root_scope_id);
  expect(inner_class!.scope_id).toBe(outer_method!.id);
});
```

### 4. Add Interface Test (20 min)

```typescript
it("BUG: interface with method signatures has wrong scope_id", () => {
  const code = `
interface IFoo {
  bar(): void;
  baz(x: number): string;
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.ts" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "typescript");

  const interface_def = Array.from(index.interfaces.values()).find(
    (i) => i.name === "IFoo"
  );

  console.log("\n=== INTERFACE BUG ===");
  console.log("Interface scope_id:", interface_def!.scope_id);
  console.log("File scope_id:", index.root_scope_id);

  expect(interface_def!.scope_id).toBe(index.root_scope_id);
});
```

### 5. Add Enum Test (20 min)

```typescript
it("BUG: enum definition has wrong scope_id", () => {
  const code = `
enum Color {
  Red,
  Green,
  Blue
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.ts" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "typescript");

  const enum_def = Array.from(index.enums.values()).find(
    (e) => e.name === "Color"
  );

  console.log("\n=== ENUM BUG ===");
  console.log("Enum scope_id:", enum_def!.scope_id);
  console.log("File scope_id:", index.root_scope_id);

  expect(enum_def!.scope_id).toBe(index.root_scope_id);
});
```

### 6. Add Control Test - Functions (15 min)

Verify functions work correctly (control group):

```typescript
it("CONTROL: function definitions should have correct scope_id", () => {
  const code = `
function outer() {
  function inner() {
    const x = 1;
  }
}
  `;

  const tree = parser.parse(code);
  const file_path = "test.ts" as FilePath;
  const parsed_file = create_parsed_file(code, file_path, tree);
  const index = build_semantic_index(parsed_file, tree, "typescript");

  const outer_func = Array.from(index.functions.values()).find(
    (f) => f.name === "outer"
  );
  const inner_func = Array.from(index.functions.values()).find(
    (f) => f.name === "inner"
  );
  const outer_scope = Array.from(index.scopes.values()).find(
    (s) => s.name === "outer"
  );

  console.log("\n=== FUNCTION CONTROL (should work) ===");
  console.log("Outer function scope_id:", outer_func!.scope_id);
  console.log("Inner function scope_id:", inner_func!.scope_id);
  console.log("Outer scope_id:", outer_scope!.id);

  // These should PASS
  expect(outer_func!.scope_id).toBe(index.root_scope_id);
  expect(inner_func!.scope_id).toBe(outer_scope!.id);
});
```

### 7. Run Tests and Document (30 min)

```bash
npm test -- scope_assignment_bug_repro.test.ts
```

Add summary comment to test file:

```typescript
/**
 * SCOPE ASSIGNMENT BUG REPRODUCTION - Issue #111
 *
 * ROOT CAUSE HYPOTHESIS:
 * - context.get_scope_id(capture.location) finds the DEEPEST scope
 * - For classes/interfaces/enums, capture.location spans the entire body
 * - Body contains nested methods/properties
 * - Result: get_scope_id returns a nested method scope instead of the declaring scope
 *
 * EXPECTED RESULTS:
 * - ❌ File-level class test: FAILS (class.scope_id === method_scope)
 * - ❌ Nested class test: FAILS (both classes point to deepest method)
 * - ❌ Interface test: FAILS (interface.scope_id === method signature scope)
 * - ❌ Enum test: FAILS (enum.scope_id === wrong scope)
 * - ✅ Function control test: PASSES (functions work correctly)
 *
 * WHY FUNCTIONS WORK:
 * [To be determined - need to investigate in task-epic-11.112.3]
 */
```

## Success Criteria

- ✅ Test file created with 6 tests
- ✅ At least 4 tests FAIL (demonstrating the bug)
- ✅ Function control test PASSES (or provides insights)
- ✅ Console output shows concrete scope_id values
- ✅ Bug mechanism documented in test file comments

## Outputs

1. Failing test file demonstrating the bug
2. Console logs showing actual vs expected scope_id values
3. Evidence for next tasks (design fix strategy)

## Next Task

**task-epic-11.112.2** - Investigate sibling scope handling necessity
