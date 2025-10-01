# Type System Analysis: Types vs Type Aliases

## The Question

Should `add_class`, `add_interface`, `add_enum` also call `add_type` since they define types?

## The Answer: NO

### Key Distinction

**Type ALIAS** (what `add_type` is for):
- An alternative name for an existing type expression
- TypeScript: `type Point = { x: number, y: number }`
- Rust: `type Kilometers = i32`
- Python: `Point: TypeAlias = tuple[int, int]`

**Type DEFINITION** (what `add_class`, `add_interface`, `add_enum` do):
- Create new nominal or structural types
- `class Point {}` - creates a new type
- `interface Drawable {}` - creates a type contract
- `enum Color { Red, Green, Blue }` - creates an enumerated type

### Builder Result Structure

The `BuilderResult` keeps these SEPARATE for good reasons:

```typescript
interface BuilderResult {
  functions: Map<SymbolId, FunctionDefinition>;
  classes: Map<SymbolId, ClassDefinition>;      // Type definition
  interfaces: Map<SymbolId, InterfaceDefinition>; // Type definition
  enums: Map<SymbolId, EnumDefinition>;          // Type definition
  types: Map<SymbolId, TypeDefinition>;          // Type ALIAS only!
  // ...
}
```

### Why Separate?

1. **Different structures**:
   - Classes: have methods, properties, constructor
   - Interfaces: have method/property signatures
   - Enums: have members
   - Type aliases: just have `type_expression`

2. **Different semantics**:
   - Classes create nominal types (identity-based)
   - Interfaces create structural types (shape-based)
   - Type aliases are transparent (just alternative names)

3. **Different querying needs**:
   - "Find all classes" - need just classes
   - "Find all types" - need classes + interfaces + enums + type aliases

## The Real Problems

### 1. Terminology Confusion

The method name `add_type` suggests it's for ALL types, but it's actually for type ALIASES only.

**Options:**
- Rename to `add_type_alias` (breaking change)
- Document clearly that it's for aliases
- Add JSDoc: `/** Add a type ALIAS (not a type definition) */`

### 2. Missing Language Coverage

| Language | Type Alias Support | Current Status |
|----------|-------------------|----------------|
| TypeScript | ✅ `type X = Y` | ✅ Implemented |
| Rust | ✅ `type X = Y` | ✅ Implemented |
| Python | ✅ `X: TypeAlias = Y` | ❌ **MISSING!** |
| JavaScript | N/A (no types) | N/A |

### 3. Missing Type Query Helpers

Consumers need to query across multiple maps to find a type:

```typescript
// Current (awkward)
function find_type(name: SymbolName, result: BuilderResult) {
  // Check classes
  for (const [id, def] of result.classes) {
    if (def.name === name) return def;
  }
  // Check interfaces
  for (const [id, def] of result.interfaces) {
    if (def.name === name) return def;
  }
  // Check enums
  for (const [id, def] of result.enums) {
    if (def.name === name) return def;
  }
  // Check type aliases
  for (const [id, def] of result.types) {
    if (def.name === name) return def;
  }
  return undefined;
}
```

**Solution:** Add helper methods to builder or result

### 4. Incomplete Type Alias Coverage

TypeScript has many type alias forms we might not capture:

```typescript
// Simple
type Point = { x: number, y: number };

// Generic
type Container<T> = { value: T };

// Union
type StringOrNumber = string | number;

// Intersection
type Combined = A & B;

// Conditional
type IsString<T> = T extends string ? true : false;

// Mapped
type Readonly<T> = { readonly [P in keyof T]: T[P] };

// Index access
type PointX = Point['x'];

// Template literal
type EventName<T extends string> = `${T}Changed`;
```

Rust also has complex forms:
```rust
type BoxedFn = Box<dyn Fn() -> i32>;
type Result<T> = std::result::Result<T, Error>;
type Predicate<T> = fn(&T) -> bool;
```

## Recommendations

### 1. Add Python TypeAlias Support

**File:** `python_builder.ts`

Add handler:
```typescript
[
  "definition.type_alias",
  {
    process: (capture, builder, context) => {
      const type_id = create_type_alias_id(capture);

      builder.add_type({
        kind: "type_alias",
        symbol_id: type_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        availability: determine_availability(capture.text),
        type_expression: extract_type_expression(capture.node),
      });
    },
  },
],
```

**Query file:** `python.scm`
```scheme
; Type alias (Python 3.10+)
(assignment
  left: (identifier) @definition.type_alias
  type: (type_alias_statement))
```

### 2. Clarify Documentation

**In `definition_builder.ts`:**

```typescript
/**
 * Add a type ALIAS definition
 *
 * Type aliases create alternative names for type expressions.
 * Do NOT use for classes, interfaces, or enums - those are
 * type definitions, not aliases.
 *
 * Examples:
 * - TypeScript: `type Point = { x: number, y: number }`
 * - Rust: `type Kilometers = i32`
 * - Python: `Point: TypeAlias = tuple[int, int]`
 *
 * @param definition - Type alias definition
 */
add_type(definition: {
  kind: "type" | "type_alias";
  // ...
}): DefinitionBuilder
```

### 3. Add Type Query Helpers (Optional)

**In `definition_builder.ts`:**

```typescript
/**
 * Get all type names from all type maps
 * Includes classes, interfaces, enums, and type aliases
 */
get_all_type_names(): Set<SymbolName> {
  const names = new Set<SymbolName>();

  this.classes.forEach((state) => names.add(state.base.name!));
  this.interfaces.forEach((state) => names.add(state.base.name!));
  this.enums.forEach((state) => names.add(state.base.name!));
  this.types.forEach((state) => names.add(state.name!));

  return names;
}

/**
 * Find a type by name across all type maps
 * Returns the symbol ID of the first match
 */
find_type_id(name: SymbolName): SymbolId | undefined {
  // Check classes
  for (const [id, state] of this.classes) {
    if (state.base.name === name) return id;
  }
  // Check interfaces
  for (const [id, state] of this.interfaces) {
    if (state.base.name === name) return id;
  }
  // Check enums
  for (const [id, state] of this.enums) {
    if (state.base.name === name) return id;
  }
  // Check type aliases
  for (const [id, state] of this.types) {
    if (state.name === name) return id;
  }

  return undefined;
}
```

### 4. Verify Type Alias Coverage

For each language, ensure ALL type alias forms are captured:

**TypeScript:** Check queries capture:
- Union types: `type X = A | B`
- Intersection types: `type X = A & B`
- Generic types: `type X<T> = ...`
- Conditional types: `type X = T extends U ? Y : Z`
- Mapped types: `type X = { [K in keyof T]: ... }`

**Rust:** Check queries capture:
- Simple aliases: `type X = Y`
- Generic aliases: `type X<T> = Y<T>`
- Trait object aliases: `type X = Box<dyn Trait>`
- Function pointer aliases: `type X = fn() -> i32`

**Python:** Add support for:
- TypeAlias annotation: `X: TypeAlias = Y`
- Generic aliases: `X: TypeAlias = list[T]`

## Task Updates Required

### Update task-epic-11.108.1 (Builder Enhancements)

Add section:
```markdown
### 4. Clarify add_type Documentation

Update JSDoc to clarify this is for TYPE ALIASES only:

- Document that classes/interfaces/enums are NOT type aliases
- Provide examples of what IS a type alias
- Explain the distinction
```

### Update task-epic-11.108.4 (Python)

Add section:
```markdown
### 5. Add TypeAlias Support

Python 3.10+ supports explicit type aliases:

```python
from typing import TypeAlias
Point: TypeAlias = tuple[int, int]
Vector: TypeAlias = list[float]
```

Add:
1. Query capture for type alias statements
2. Handler in python_builder.ts
3. Tests for type alias extraction
```

### Add New Task: 11.108.10 - Verify Type Alias Coverage

New task to audit and verify all type alias forms are captured:

```markdown
# Task 11.108.10: Verify Complete Type Alias Coverage

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 2-3 hours
**Parent:** task-epic-11.108

## Objective

Ensure all forms of type aliases are captured in TypeScript, Rust, and Python.

## Coverage Checklist

### TypeScript
- [ ] Simple: `type Point = { x: number }`
- [ ] Generic: `type Container<T> = { value: T }`
- [ ] Union: `type X = A | B`
- [ ] Intersection: `type X = A & B`
- [ ] Conditional: `type X<T> = T extends U ? Y : Z`
- [ ] Mapped: `type X = { [K in keyof T]: V }`
- [ ] Template literal: `type X = \`\${T}Changed\``
- [ ] Index access: `type X = Point['x']`

### Rust
- [ ] Simple: `type X = Y`
- [ ] Generic: `type X<T> = Y<T>`
- [ ] Trait object: `type X = Box<dyn Trait>`
- [ ] Function pointer: `type X = fn() -> i32`
- [ ] With bounds: `type X<T: Display> = Y<T>`

### Python
- [ ] TypeAlias: `X: TypeAlias = Y`
- [ ] Generic: `X: TypeAlias = list[T]`
- [ ] Union: `X: TypeAlias = str | int`
```

## Summary

**Do NOT** make `add_class`, `add_interface`, `add_enum` call `add_type`:
- They serve different purposes
- Type aliases are transparent; classes/interfaces/enums are not
- Kept separate for structural and semantic reasons

**DO** fix:
1. Add Python TypeAlias support
2. Clarify `add_type` documentation
3. Verify complete type alias coverage
4. Optionally add type query helpers
