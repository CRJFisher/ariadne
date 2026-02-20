# Task 11.108.10: Verify Complete Type Alias Coverage

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.108
**Dependencies:**
- task-epic-11.108.1 (builder documentation clarified)
- task-epic-11.108.3 (TypeScript processing)
- task-epic-11.108.4 (Python TypeAlias added)
- task-epic-11.108.5 (Rust processing)

## Objective

Verify that all forms of type aliases are properly captured across TypeScript, Rust, and Python. Ensure queries and handlers cover the full spectrum of type alias syntax.

## Background

The `add_type` method is specifically for TYPE ALIASES, not all types:
- Classes, interfaces, enums are type DEFINITIONS (use dedicated methods)
- Type aliases are transparent alternative names for type expressions
- See [TYPE_SYSTEM_ANALYSIS.md](../../../TYPE_SYSTEM_ANALYSIS.md) for full explanation

## Type Alias Forms by Language

### TypeScript

TypeScript has the richest type alias syntax:

```typescript
// Simple object type
type Point = { x: number, y: number };

// Generic type
type Container<T> = { value: T };

// Generic with constraints
type Constrained<T extends string> = { value: T };

// Union type
type StringOrNumber = string | number;

// Intersection type
type Combined = A & B;

// Conditional type
type IsString<T> = T extends string ? true : false;

// Mapped type
type Readonly<T> = { readonly [P in keyof T]: T[P] };

// Template literal type
type EventName<T extends string> = `${T}Changed`;

// Index access type
type PointX = Point['x'];

// Tuple type
type Pair = [string, number];

// Function type
type Callback = (x: number) => void;

// Constructor type
type Constructor<T> = new (...args: any[]) => T;
```

### Rust

Rust type aliases are simpler but still varied:

```rust
// Simple type alias
type Kilometers = i32;

// Generic type alias
type Result<T> = std::result::Result<T, Error>;

// Generic with bounds
type BoxedDisplay<T: Display> = Box<T>;

// Trait object alias
type Callback = Box<dyn Fn() -> i32>;

// Function pointer alias
type Predicate<T> = fn(&T) -> bool;

// Tuple alias
type Point = (i32, i32);

// Array alias
type Matrix = [[f64; 4]; 4];

// Associated type alias in impl
impl Trait for Foo {
    type Item = String;
}
```

### Python

Python type aliases (3.10+):

```python
from typing import TypeAlias, Callable, Union

# Simple type alias
Point: TypeAlias = tuple[int, int]

# Generic type alias
Vector: TypeAlias = list[float]

# Union type alias
StringOrInt: TypeAlias = str | int  # Or Union[str, int]

# Callable type alias
Callback: TypeAlias = Callable[[int, str], bool]

# Complex nested type alias
NestedData: TypeAlias = dict[str, list[tuple[int, str]]]

# Optional type alias
MaybeString: TypeAlias = str | None  # Or Optional[str]
```

## Verification Checklist

### TypeScript Type Aliases

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/typescript.scm`

Verify query captures:
- [ ] Simple object types: `type X = { ... }`
- [ ] Generic types: `type X<T> = ...`
- [ ] Generic with constraints: `type X<T extends Y> = ...`
- [ ] Union types: `type X = A | B`
- [ ] Intersection types: `type X = A & B`
- [ ] Conditional types: `type X<T> = T extends U ? Y : Z`
- [ ] Mapped types: `type X = { [K in keyof T]: ... }`
- [ ] Template literal types: `type X = \`...\``
- [ ] Index access types: `type X = Y['field']`
- [ ] Function types: `type X = (a: T) => U`
- [ ] Constructor types: `type X = new (...args: any[]) => T`

**Test file:** `semantic_index.typescript.test.ts`

Add comprehensive test:
```typescript
it("captures all type alias forms", () => {
  const code = `
    type Simple = { x: number };
    type Generic<T> = { value: T };
    type Union = string | number;
    type Intersection = A & B;
    type Conditional<T> = T extends string ? true : false;
    type Mapped<T> = { readonly [K in keyof T]: T[K] };
    type Callback = (x: number) => void;
  `;

  const result = index_single_file(code, "test.ts" as FilePath, "typescript");

  const type_aliases = Array.from(result.types?.values() || []);
  expect(type_aliases).toHaveLength(7);

  const simple = type_aliases.find((t) => t.name === "Simple");
  expect(simple?.kind).toBe("type_alias");
  expect(simple?.type_expression).toContain("{ x: number }");

  const generic = type_aliases.find((t) => t.name === "Generic");
  expect(generic?.type_parameters).toEqual(["T"]);

  // Verify each form...
});
```

### Rust Type Aliases

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/rust.scm`

Verify query captures:
- [ ] Simple aliases: `type X = Y;`
- [ ] Generic aliases: `type X<T> = Y<T>;`
- [ ] Generic with bounds: `type X<T: Display> = ...;`
- [ ] Trait object aliases: `type X = Box<dyn Trait>;`
- [ ] Function pointer aliases: `type X = fn() -> T;`
- [ ] Tuple aliases: `type X = (T, U);`
- [ ] Array aliases: `type X = [T; N];`
- [ ] Associated type in impl: `type Item = T;`

**Test file:** `semantic_index.rust.test.ts`

Add test:
```typescript
it("captures all type alias forms", () => {
  const code = `
    type Kilometers = i32;
    type Result<T> = std::result::Result<T, Error>;
    type Callback = Box<dyn Fn() -> i32>;
    type Predicate<T> = fn(&T) -> bool;
    type Point = (i32, i32);
  `;

  const result = index_single_file(code, "test.rs" as FilePath, "rust");

  const type_aliases = Array.from(result.types?.values() || []);
  expect(type_aliases).toHaveLength(5);

  const kilometers = type_aliases.find((t) => t.name === "Kilometers");
  expect(kilometers?.kind).toBe("type_alias");
  expect(kilometers?.type_expression).toBe("i32");

  const result_type = type_aliases.find((t) => t.name === "Result");
  expect(result_type?.type_parameters).toEqual(["T"]);
});
```

### Python Type Aliases

**File:** `packages/core/src/index_single_file/query_code_tree/language_configs/queries/python.scm`

Verify query captures:
- [ ] TypeAlias annotation: `X: TypeAlias = Y`
- [ ] Simple types: `X: TypeAlias = tuple[int, int]`
- [ ] Generic types: `X: TypeAlias = list[T]`
- [ ] Union types: `X: TypeAlias = str | int`
- [ ] Callable types: `X: TypeAlias = Callable[[T], U]`
- [ ] Complex nested types

**Test file:** `semantic_index.python.test.ts`

Add test (should be added in task 11.108.4):
```typescript
it("captures type aliases", () => {
  const code = `
from typing import TypeAlias, Callable

Point: TypeAlias = tuple[int, int]
Vector: TypeAlias = list[float]
StringOrInt: TypeAlias = str | int
Callback: TypeAlias = Callable[[int], str]
  `;

  const result = index_single_file(code, "test.py" as FilePath, "python");

  const type_aliases = Array.from(result.types?.values() || []);
  expect(type_aliases).toHaveLength(4);

  const point = type_aliases.find((t) => t.name === "Point");
  expect(point?.kind).toBe("type_alias");
  expect(point?.type_expression).toBe("tuple[int, int]");

  const callback = type_aliases.find((t) => t.name === "Callback");
  expect(callback?.type_expression).toContain("Callable");
});
```

## Implementation Steps

1. **Review query files:**
   - Read each language's .scm file
   - Identify type alias patterns
   - Verify all forms are captured

2. **Review builders:**
   - Check `typescript_builder.ts` type alias handler
   - Check `rust_builder.ts` type alias handler
   - Check `python_builder.ts` type alias handler (after 11.108.4)

3. **Add missing query patterns:**
   - If any type alias forms are missing, add captures
   - Test queries with tree-sitter playground if available

4. **Update handlers:**
   - Ensure handlers extract all relevant info
   - Type parameters, constraints, expressions

5. **Add comprehensive tests:**
   - One test per language covering all forms
   - Verify `type_expression` field is populated
   - Verify `type_parameters` field when present

6. **Verify:**
   ```bash
   npm test -- semantic_index.typescript.test.ts
   npm test -- semantic_index.rust.test.ts
   npm test -- semantic_index.python.test.ts
   ```

## Success Criteria

- ✅ All type alias forms listed above have query captures
- ✅ Handlers extract complete information
- ✅ Tests verify all forms work
- ✅ All tests pass
- ✅ Documentation updated if gaps found

## Edge Cases to Consider

### TypeScript
- Type aliases vs interface declarations (different things!)
- Type parameters with defaults: `type X<T = string> = ...`
- Type parameters with multiple constraints: `type X<T extends A & B> = ...`

### Rust
- Associated types in trait impl vs trait definitions
- Type aliases in module scope vs impl scope
- Visibility modifiers on type aliases

### Python
- Older style type aliases (without TypeAlias annotation)
- Type aliases with forward references
- Type aliases using typing.Type vs typing.TypeAlias

## Reference Documentation

- [TYPE_SYSTEM_ANALYSIS.md](../../../TYPE_SYSTEM_ANALYSIS.md) - Type vs type alias distinction
- [TypeScript Handbook - Type Aliases](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-aliases)
- [Rust Reference - Type Aliases](https://doc.rust-lang.org/reference/items/type-aliases.html)
- [PEP 613 - Explicit Type Aliases](https://peps.python.org/pep-0613/)

## Related Files

- Query files: `packages/core/src/index_single_file/query_code_tree/language_configs/queries/*.scm`
- Builder files: `packages/core/src/index_single_file/query_code_tree/language_configs/*_builder.ts`
- Test files: `packages/core/src/index_single_file/semantic_index.*.test.ts`

## Notes

This task ensures complete type alias coverage across all languages. Type aliases are crucial for:
- Type-based symbol resolution
- Understanding type relationships
- Code navigation ("find all usages of this type")
- Refactoring (renaming types)

Without complete coverage, these features won't work reliably for aliased types.
