# Task 104.5: Implement Rust Metadata Extraction (4 Sub-tasks)

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 5 hours total
**Parent:** task-epic-11.104
**Dependencies:** task-epic-11.104.3 (JavaScript complete)

## Overview

Implement language-specific metadata extractors for Rust, handling Rust's unique AST structure including ownership, lifetimes, and turbofish syntax.

## Sub-Tasks

### 104.5.1 - Implement rust_metadata.ts (2.5 hours)

Create `packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.ts`

**Key Differences from JavaScript:**
- Method calls: `call_expression` with `field_expression`
- Type annotations: Type after colon: `let x: i32 = 5`
- Property access: `field_expression` nodes
- Constructor calls: May use `struct_expression` or function call
- Generic syntax: Turbofish `::<T>` or `<T>` in types
- References: `&` and `&mut` prefixes

**Rust AST Examples:**
```rust
// Method call:
obj.method()
// → call_expression { function: field_expression { value: "obj", field: "method" } }

// Type annotation:
let x: i32 = 5;
// → let_declaration { type: primitive_type "i32" }

// Generic type:
Vec::<String>::new()
// → type_arguments with turbofish

// Reference type:
fn foo(x: &str) -> &str
// → reference_type { type: primitive_type "str" }
```

**Implementation Notes:**
- Handle `field_expression` for property access
- Extract turbofish generics: `::<T>`
- Handle reference types: `&T`, `&mut T`
- Handle trait bounds in type annotations
- Constructor calls may be `struct_expression` or function calls

**Rust-Specific Challenges:**
- Ownership syntax: `&`, `&mut`, `Box<T>`, `Rc<T>`
- Lifetime parameters: `'a`, `'static`
- Associated types: `Iterator::Item`
- Trait objects: `dyn Trait`

### 104.5.2 - Test rust_metadata.ts (1.5 hours)

Create `packages/core/src/index_single_file/query_code_tree/language_configs/rust_metadata.test.ts`

**Test Cases:**
- Method call receiver: `obj.method()`
- Property chain: `a.b.c.d`
- Type annotation: `let x: i32 = 5`
- Reference types: `let x: &str = "hello"`
- Generic types: `Vec<String>`, `HashMap<K, V>`
- Turbofish: `Vec::<i32>::new()`
- Assignment parts: `target = source`
- Constructor: `let obj = MyStruct { field: value }`

**Rust-Specific Tests:**
- Lifetime parameters in types
- Mutable references: `&mut T`
- Associated types: `T::AssociatedType`
- Trait bounds: `T: Clone`

### 104.5.3 - Wire Rust Extractors (30 minutes)

Update `semantic_index.ts`:

```typescript
import { RUST_METADATA_EXTRACTORS } from "./query_code_tree/language_configs/rust_metadata";

function get_metadata_extractors(language: Language): MetadataExtractors {
  switch (language) {
    case "javascript":
    case "typescript":
      return JAVASCRIPT_METADATA_EXTRACTORS;
    case "python":
      return PYTHON_METADATA_EXTRACTORS;
    case "rust":
      return RUST_METADATA_EXTRACTORS;  // NEW
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
```

Remove the `throw` statement that was temporarily added for Rust.

### 104.5.4 - Fix semantic_index.rust.test.ts (30 minutes)

Update Rust integration tests:
- Add metadata assertions
- Test method call receivers
- Test property chains
- Test type annotations with primitives
- Test generic type extraction
- Test reference type handling
- Handle Rust-specific patterns (lifetimes, ownership)

## Rust AST Reference

Use tree-sitter CLI to explore:
```bash
npx tree-sitter parse --scope source.rust "obj.method()"
npx tree-sitter parse --scope source.rust "let x: Vec<String> = Vec::new();"
```

Or use Rust tree-sitter playground: https://tree-sitter.github.io/tree-sitter/playground

## Success Criteria (All Sub-tasks)

- ✅ `rust_metadata.ts` created and implements all 6 extractors
- ✅ Tests pass with >95% coverage
- ✅ Rust extractors wired into semantic_index.ts
- ✅ semantic_index.rust.test.ts passes
- ✅ Rust-specific patterns handled (generics, references, lifetimes)

## Notes

### Rust Type System Complexity

Rust has the most complex type system of the four languages:
- Generic type parameters: `<T>`
- Lifetime parameters: `<'a>`
- Trait bounds: `T: Clone + Debug`
- Associated types: `<T as Iterator>::Item`
- Higher-ranked trait bounds: `for<'a> Fn(&'a T)`

Start with basics (primitives, simple generics), add complexity incrementally.

### Turbofish Syntax

The turbofish (`::<T>`) is unique to Rust and used in:
- Method calls: `iter.collect::<Vec<_>>()`
- Associated functions: `Vec::<String>::new()`

Must handle both generic syntax styles.

### Field Expression vs Member Expression

Rust uses `field_expression` where JavaScript uses `member_expression`:
```rust
obj.field  // field_expression
```

This is semantically similar but structurally different in AST.

## Related Files

- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_metadata.ts` (reference)
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder.ts` (Rust builder helpers)
- `packages/core/src/index_single_file/semantic_index.rust.test.ts` (integration tests)
