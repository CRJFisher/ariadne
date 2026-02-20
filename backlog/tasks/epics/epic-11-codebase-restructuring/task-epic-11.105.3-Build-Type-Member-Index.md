# Task 11.105.3: Build Type Member Index

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2 hours
**Parent:** task-epic-11.105
**Dependencies:** None

## Objective

Build a map of type SymbolId → members (methods, properties, constructor) from ClassDefinition and InterfaceDefinition. This enables efficient lookup of which methods/properties a type has.

## Implementation

### File

`packages/core/src/index_single_file/type_preprocessing/member_extraction.ts`

### Core Function

```typescript
import type { SymbolId, SymbolName } from "@ariadnejs/types";
import type { BuilderResult } from "../definitions/definition_builder";

/**
 * Type member information
 */
export interface TypeMemberInfo {
  /** Methods by name */
  readonly methods: ReadonlyMap<SymbolName, SymbolId>;

  /** Properties by name */
  readonly properties: ReadonlyMap<SymbolName, SymbolId>;

  /** Constructor (if any) */
  readonly constructor?: SymbolId;

  /** Types this extends (for inheritance lookup in 11.109.3) */
  readonly extends: readonly SymbolName[];
}

/**
 * Extract type members from class and interface definitions
 *
 * Builds a map of type SymbolId → its members for efficient lookup
 * during method resolution. Tracks inheritance for future resolution.
 */
export function extract_type_members(
  definitions: BuilderResult
): Map<SymbolId, TypeMemberInfo> {
  const members = new Map<SymbolId, TypeMemberInfo>();

  // 1. Extract from classes
  for (const [class_id, class_def] of definitions.classes) {
    const methods = new Map<SymbolName, SymbolId>();
    const properties = new Map<SymbolName, SymbolId>();

    // Index methods
    for (const method of class_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    // Index properties
    for (const prop of class_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    // Get constructor
    const constructor_id = class_def.constructor?.[0]?.symbol_id;

    // Get extends (store as SymbolName strings, resolved later)
    const extends_names = class_def.extends || [];

    members.set(class_id, {
      methods,
      properties,
      constructor: constructor_id,
      extends: extends_names,
    });
  }

  // 2. Extract from interfaces
  for (const [iface_id, iface_def] of definitions.interfaces) {
    const methods = new Map<SymbolName, SymbolId>();
    const properties = new Map<SymbolName, SymbolId>();

    // Index method signatures
    for (const method of iface_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    // Index property signatures
    for (const prop of iface_def.properties) {
      properties.set(prop.name, prop.symbol_id);
    }

    // Get extends (interfaces can extend other interfaces)
    const extends_names = iface_def.extends || [];

    members.set(iface_id, {
      methods,
      properties,
      constructor: undefined, // Interfaces don't have constructors
      extends: extends_names,
    });
  }

  // 3. Extract from enums (Rust enums can have methods)
  for (const [enum_id, enum_def] of definitions.enums) {
    if (!enum_def.methods || enum_def.methods.length === 0) continue;

    const methods = new Map<SymbolName, SymbolId>();

    for (const method of enum_def.methods) {
      methods.set(method.name, method.symbol_id);
    }

    members.set(enum_id, {
      methods,
      properties: new Map(), // Enums don't have properties in this model
      constructor: undefined,
      extends: [],
    });
  }

  return members;
}
```

## Test Coverage

### Test File

`type_preprocessing/tests/member_extraction.test.ts`

### Test Cases

#### TypeScript
```typescript
test("extracts class methods and properties", () => {
  const code = `
    class User {
      name: string;
      email: string;

      getName(): string { return this.name; }
      getEmail(): string { return this.email; }
    }
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(user_class_id);

  expect(user_members.methods.size).toBe(2);
  expect(user_members.methods.has("getName")).toBe(true);
  expect(user_members.methods.has("getEmail")).toBe(true);

  expect(user_members.properties.size).toBe(2);
  expect(user_members.properties.has("name")).toBe(true);
  expect(user_members.properties.has("email")).toBe(true);
});

test("tracks constructor", () => {
  const code = `
    class User {
      constructor(name: string) {}
    }
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(user_class_id);

  expect(user_members.constructor).toBeDefined();
});

test("tracks inheritance", () => {
  const code = `
    class Animal {
      move() {}
    }
    class Dog extends Animal {
      bark() {}
    }
  `;

  const members = extract_type_members(definitions);
  const dog_members = members.get(dog_class_id);

  // Should store extends as string array
  expect(dog_members.extends).toContain("Animal");

  // Direct members only (inheritance resolved in 11.109.3)
  expect(dog_members.methods.has("bark")).toBe(true);
  expect(dog_members.methods.has("move")).toBe(false); // Not included yet
});

test("handles static methods", () => {
  const code = `
    class User {
      static create() { return new User(); }
      getName() { return ""; }
    }
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(user_class_id);

  // Both static and instance methods indexed
  expect(user_members.methods.has("create")).toBe(true);
  expect(user_members.methods.has("getName")).toBe(true);
});
```

#### Interface
```typescript
test("extracts interface method signatures", () => {
  const code = `
    interface IUser {
      getName(): string;
      getEmail(): string;
    }
  `;

  const members = extract_type_members(definitions);
  const iface_members = members.get(iface_id);

  expect(iface_members.methods.size).toBe(2);
  expect(iface_members.methods.has("getName")).toBe(true);
  expect(iface_members.methods.has("getEmail")).toBe(true);
  expect(iface_members.constructor).toBeUndefined();
});

test("tracks interface extension", () => {
  const code = `
    interface IBase {
      id: number;
    }
    interface IUser extends IBase {
      name: string;
    }
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(iuser_id);

  expect(user_members.extends).toContain("IBase");
});
```

#### Python
```python
test("extracts Python class methods", () => {
  const code = `
    class User:
        def get_name(self) -> str:
            pass

        def get_email(self) -> str:
            pass
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(user_class_id);

  expect(user_members.methods.has("get_name")).toBe(true);
  expect(user_members.methods.has("get_email")).toBe(true);
});
```

#### Rust
```rust
test("extracts Rust struct methods", () => {
  const code = `
    struct User {}

    impl User {
        fn new() -> User { User {} }
        fn get_name(&self) -> String { String::new() }
    }
  `;

  const members = extract_type_members(definitions);
  const user_members = members.get(user_struct_id);

  expect(user_members.methods.has("new")).toBe(true);
  expect(user_members.methods.has("get_name")).toBe(true);
});

test("extracts Rust enum methods", () => {
  const code = `
    enum Result {
        Ok(i32),
        Err(String)
    }

    impl Result {
        fn is_ok(&self) -> bool { true }
    }
  `;

  const members = extract_type_members(definitions);
  const result_members = members.get(result_enum_id);

  expect(result_members.methods.has("is_ok")).toBe(true);
});
```

### Edge Cases

- Empty classes (valid, just no members)
- Abstract methods (included in method list)
- Private methods (included, visibility handled elsewhere)
- Overloaded methods (all overloads share same name, first one wins)

## Success Criteria

### Functional
- ✅ Class methods and properties indexed
- ✅ Interface methods and properties indexed
- ✅ Constructor tracked
- ✅ Inheritance tracked (as string array)
- ✅ All 4 languages supported

### Testing
- ✅ Unit tests for classes
- ✅ Unit tests for interfaces
- ✅ Inheritance edge cases
- ✅ >90% code coverage

### Code Quality
- ✅ Clear JSDoc comments
- ✅ Type-safe implementation
- ✅ Efficient Map-based lookup

## Dependencies

**Uses:**
- `BuilderResult` from definition_builder
- `ClassDefinition`, `InterfaceDefinition`, `EnumDefinition`

**No external dependencies**

## Next Steps

After completion:
- Task 11.105.5 adds this to SemanticIndex
- Task 11.109.3 uses for member lookup during method resolution
- Task 11.109.3 resolves `extends` strings to SymbolIds for inheritance

## Technical Notes

### Inheritance Resolution

This task stores `extends` as SymbolName strings:
```typescript
extends: ["Animal", "IBase"]
```

Task 11.109.3 will resolve these to SymbolIds using ScopeResolver:
```typescript
// In 11.109.3:
const parent_id = scope_resolver.resolve_in_scope("Animal", class_scope);
```

This enables proper inheritance lookup that respects imports and shadowing.

### Static vs Instance Methods

Both are included in the same `methods` map. The `static` modifier is stored in the MethodDefinition itself, not in this index. During method resolution:
- Instance method calls lookup in `methods`
- Static method calls also lookup in `methods` (but check `static` flag)

### Performance

Map-based lookup provides O(1) member access by name. With typical classes having 5-20 methods, this is very efficient.
