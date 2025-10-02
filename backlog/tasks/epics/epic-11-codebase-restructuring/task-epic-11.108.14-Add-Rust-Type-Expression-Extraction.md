# Task 11.108.14: Add Rust Type Expression Extraction

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1-2 hours
**Parent:** task-epic-11.108
**Dependencies:** None
**Related:** task-epic-11.105.4 (where this was discovered)

## Objective

Add `extract_type_expression()` helper function to Rust builder to extract the right-hand side of type alias declarations. This enables complete type alias metadata extraction for Rust, bringing it to parity with TypeScript and Python.

## Problem Statement

**From task-epic-11.105.4 findings:**

Rust type aliases are captured and stored, but the `type_expression` field is always `undefined` because the Rust builder doesn't have an `extract_type_expression()` helper function.

**Example:**
```rust
type Kilometers = i32;                           // type_expression should be "i32"
type Result<T> = std::result::Result<T, Error>;  // type_expression should be "std::result::Result<T, Error>"
type Callback = Box<dyn Fn() -> i32>;            // type_expression should be "Box<dyn Fn() -> i32>"
```

**Current behavior:** Type aliases stored with `type_expression: undefined`

**Desired behavior:** Type aliases stored with full type expression text

## Reference Implementations

### TypeScript

**File:** `typescript_builder.ts:399`

```typescript
export function extract_type_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent?.type === "type_alias_declaration") {
    const value = parent.childForFieldName?.("value");
    return value?.text;
  }
  return undefined;
}
```

**Usage in handler:**
```typescript
[
  "definition.type_alias",
  {
    process: (capture, builder, context) => {
      builder.add_type({
        // ...
        type_expression: extract_type_expression(capture.node),  // ← Used here
      });
    },
  },
]
```

### Python

**File:** `python_builder.ts` (similar pattern)

```typescript
function extract_type_alias_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent?.type === "annotated_assignment") {
    const valueNode = parent.childForFieldName?.("value");
    return valueNode?.text;
  }
  return undefined;
}
```

## Implementation

### Step 1: Inspect Rust Type Alias AST

Check the AST structure for Rust type aliases:

```rust
// test_sample.rs
type Kilometers = i32;
type Point = (i32, i32);
type Result<T> = std::result::Result<T, Error>;
```

```bash
tree-sitter parse test_sample.rs
```

**Expected AST structure:**
```
(type_item
  name: (type_identifier) @name
  type: (...) @type_expression)
```

The type expression should be accessible via `childForFieldName("type")`.

### Step 2: Add Helper Function

**File:** [packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts)

**Add function:**

```typescript
/**
 * Extract type expression from type alias declaration
 *
 * @param node - The type alias name node
 * @returns The type expression text or undefined
 *
 * @example
 * type Kilometers = i32;  // Returns "i32"
 * type Result<T> = std::result::Result<T, Error>;  // Returns "std::result::Result<T, Error>"
 */
export function extract_type_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (!parent || parent.type !== "type_item") {
    return undefined;
  }

  const typeNode = parent.childForFieldName?.("type");
  return typeNode?.text;
}
```

### Step 3: Update Type Alias Handler

**File:** [packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts)

**Find type alias handler and update:**

```typescript
import { extract_type_expression } from "./rust_builder_helpers";  // ← Add import

// Find the type alias handler (search for "definition.type" or similar)
[
  "definition.type_alias",  // or whatever the capture name is
  {
    process: (capture, builder, context) => {
      const type_id = create_type_alias_id(capture);

      builder.add_type({
        kind: "type_alias",
        symbol_id: type_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: extract_visibility(capture.node.parent || capture.node),
        type_expression: extract_type_expression(capture.node),  // ← Add this line
        type_parameters: extract_type_parameters(capture.node.parent || capture.node),
      });
    },
  },
]
```

### Step 4: Write Test

**File:** `semantic_index.rust.test.ts`

**Add test case:**

```typescript
it("extracts type alias with type expression", () => {
  const code = `
    type Kilometers = i32;
    type Point = (i32, i32);
    type Result<T> = std::result::Result<T, Error>;
    type Callback = Box<dyn Fn() -> i32>;
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const type_aliases = Array.from(result.definitions.values()).filter(
    (d) => d.kind === "type_alias"
  );

  expect(type_aliases.length).toBeGreaterThanOrEqual(4);

  // Check Kilometers
  const kilometers = type_aliases.find((t) => t.name === "Kilometers");
  expect(kilometers).toBeDefined();
  expect(kilometers?.type_expression).toBe("i32");

  // Check Point (tuple type)
  const point = type_aliases.find((t) => t.name === "Point");
  expect(point).toBeDefined();
  expect(point?.type_expression).toBe("(i32, i32)");

  // Check Result (generic with type parameters)
  const result_type = type_aliases.find((t) => t.name === "Result");
  expect(result_type).toBeDefined();
  expect(result_type?.type_expression).toBe("std::result::Result<T, Error>");
  expect(result_type?.type_parameters).toEqual(["T"]);

  // Check Callback (trait object)
  const callback = type_aliases.find((t) => t.name === "Callback");
  expect(callback).toBeDefined();
  expect(callback?.type_expression).toBe("Box<dyn Fn() -> i32>");
});
```

### Step 5: Re-enable Skipped Tests

**From task 11.105.4, these tests were skipped:**

Find in `semantic_index.rust.test.ts`:

```typescript
it.skip("should extract type alias type expressions", () => {
  // Re-enable by removing .skip
});
```

Change to:
```typescript
it("should extract type alias type expressions", () => {
  // Test should now pass
});
```

## Verification Steps

1. **Add helper function:**
   ```bash
   grep -n "extract_type_expression" packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts
   ```

2. **Update handler:**
   ```bash
   grep -A 10 "definition.type_alias" packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts
   ```

3. **Run tests:**
   ```bash
   npm test -- semantic_index.rust.test.ts -t "type alias"
   ```

4. **Verify no regressions:**
   ```bash
   npm test -- semantic_index.rust.test.ts
   ```

## Success Criteria

- ✅ `extract_type_expression()` helper function implemented
- ✅ Helper properly extracts type from `type_item` AST node
- ✅ Type alias handler updated to use helper
- ✅ Type expression populated for all type alias forms:
  - Simple types (`type X = Y`)
  - Tuple types (`type X = (A, B)`)
  - Generic types (`type X<T> = Y<T>`)
  - Trait objects (`type X = Box<dyn Trait>`)
  - Function pointers (`type X = fn() -> Y`)
- ✅ New test passes
- ✅ Previously skipped tests (from 11.105.4) re-enabled and passing
- ✅ No regressions in existing Rust tests
- ✅ TypeScript compilation succeeds

## Edge Cases

### Associated Types in Impl

```rust
impl Trait for Foo {
    type Item = String;  // ← Should extract "String"
}
```

May need separate handling if AST structure differs from module-level type aliases.

### Complex Type Expressions

```rust
type Complex = HashMap<String, Vec<Result<i32, Error>>>;
```

Should extract the full nested type expression as-is.

### Lifetime Parameters

```rust
type Ref<'a, T> = &'a T;
```

Should extract `&'a T` including lifetime annotation.

## Related Files

- [rust_builder_helpers.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_helpers.ts) - Add helper here
- [rust_builder.ts](../../../packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts) - Update handler here
- [semantic_index.rust.test.ts](../../../packages/core/src/index_single_file/semantic_index.rust.test.ts) - Add test here
- [task-epic-11.105.4-Implement-Type-Preprocessing.md](task-epic-11.105.4-Implement-Type-Preprocessing.md) - Where this was discovered

## Reference Tasks

- **task-epic-11.105.4** - Originally discovered this limitation
- **task-epic-11.108.10** - Type alias coverage verification (will verify this works)

## Notes

This is a **simple enhancement** that brings Rust type alias extraction to parity with TypeScript and Python. The AST node structure is straightforward - just need to access the `type` field.

**Impact:** Enables better type-based analysis, refactoring, and navigation for Rust type aliases.

**Time estimate:** 1-2 hours including helper implementation, handler update, and testing.
