# Task 11.105.2: Extract Constructor Bindings

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 hours
**Parent:** task-epic-11.105
**Dependencies:** None

## Objective

Track constructor calls and their assignment targets to determine variable types. When `const x = new User()` is seen, record that `x` has type `User`.

## Implementation

### File

`packages/core/src/index_single_file/type_preprocessing/constructor_tracking.ts`

### Core Function

```typescript
import type { LocationKey, SymbolName, SymbolReference } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Extract constructor bindings from references
 *
 * Tracks constructor calls and their assignment targets:
 * - const x = new User() → x has type User
 * - this.service = new Service() → this.service has type Service
 *
 * Note: Extracts class NAME (string), not resolved SymbolId.
 * Resolution happens in task 11.109.3 using ScopeResolver.
 */
export function extract_constructor_bindings(
  references: readonly SymbolReference[]
): Map<LocationKey, SymbolName> {
  const bindings = new Map<LocationKey, SymbolName>();

  for (const ref of references) {
    // Only process constructor calls
    if (ref.call_type !== "constructor") continue;

    // Get the assignment target from context
    const target_location = ref.context?.construct_target;
    if (!target_location) continue;

    // ref.name is the class being constructed
    const class_name = ref.name;

    // Record binding: target location → class name
    const target_key = location_key(target_location);
    bindings.set(target_key, class_name);
  }

  return bindings;
}
```

## Test Coverage

### Test File

`type_preprocessing/tests/constructor_tracking.test.ts`

### Test Cases

#### TypeScript
```typescript
test("tracks simple constructor assignment", () => {
  const code = `
    class User {
      getName() { return ""; }
    }
    const user = new User();
  `;

  const bindings = extract_constructor_bindings(references);

  // Should bind user location → "User"
  expect(bindings.get(user_location)).toBe("User");
});

test("tracks property constructor assignment", () => {
  const code = `
    class Service {
      private user: User;

      constructor() {
        this.user = new User();
      }
    }
  `;

  const bindings = extract_constructor_bindings(references);

  // Should bind this.user location → "User"
  expect(bindings.get(property_location)).toBe("User");
});

test("tracks multiple constructor calls", () => {
  const code = `
    const user = new User();
    const admin = new Admin();
    const guest = new Guest();
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.size).toBe(3);
  expect(bindings.get(user_location)).toBe("User");
  expect(bindings.get(admin_location)).toBe("Admin");
  expect(bindings.get(guest_location)).toBe("Guest");
});

test("handles destructured assignment", () => {
  const code = `
    const { user } = { user: new User() };
  `;

  // May not be supported initially - document limitation
});
```

#### Python
```python
test("tracks Python constructor assignment", () => {
  const code = `
    class User:
        pass

    user = User()
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.get(user_location)).toBe("User");
});

test("tracks method assignment in Python", () => {
  const code = `
    class Service:
        def __init__(self):
            self.user = User()
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.get(self_user_location)).toBe("User");
});
```

#### Rust
```rust
test("tracks Rust struct construction", () => {
  const code = `
    struct User {}

    impl User {
        fn new() -> User {
            User {}
        }
    }

    let user = User::new();
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.get(user_location)).toBe("User");
});

test("tracks Rust direct struct literal", () => {
  const code = `
    struct User {
        name: String
    }

    let user = User { name: String::from("test") };
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.get(user_location)).toBe("User");
});
```

#### JavaScript
```javascript
test("tracks JavaScript constructor", () => {
  const code = `
    class User {
      getName() { return ""; }
    }
    const user = new User();
  `;

  const bindings = extract_constructor_bindings(references);

  expect(bindings.get(user_location)).toBe("User");
});
```

### Edge Cases

- Constructor without assignment (skip)
- Chained constructors: `new User().setup()` (track User for result of `new User()`)
- Constructor in conditional: `const x = cond ? new User() : new Admin()` (may track both)
- Anonymous classes: `new class {}()` (skip, no name)

## Success Criteria

### Functional
- ✅ Simple constructor assignments tracked
- ✅ Property assignments tracked
- ✅ All 4 languages supported
- ✅ Multiple constructor calls in same scope handled

### Testing
- ✅ Unit tests for each language
- ✅ Edge cases documented
- ✅ >90% code coverage

### Code Quality
- ✅ Clear JSDoc comments
- ✅ Type-safe implementation
- ✅ Pythonic naming

## Dependencies

**Uses:**
- `SymbolReference` with `call_type` and `construct_target`
- `LocationKey`, `SymbolName` from types

**Requires:**
- SymbolReference must have `construct_target` populated (already done in reference_builder)

## Next Steps

After completion:
- Task 11.105.1 extracts type annotations
- Both merged in task 11.105.5
- Combined bindings used by 11.109.3

## Technical Notes

### construct_target Extraction

The `construct_target` field in `SymbolReference` is populated by tree-sitter queries:

**TypeScript pattern:**
```scheme
(variable_declarator
  name: (identifier) @construct.target
  value: (new_expression
    constructor: (identifier) @construct.class))
```

**Python pattern:**
```scheme
(assignment
  left: (identifier) @construct.target
  right: (call
    function: (identifier) @construct.class))
```

This extraction already happens in `reference_builder.ts`.

### Binding Priority

When both type annotation and constructor exist:
```typescript
const user: User = new User();
```

Both bindings are recorded:
- 105.1 extracts: user → "User" (from annotation)
- 105.2 extracts: user → "User" (from constructor)

In 11.105.5, when merging, constructor bindings can override annotation bindings (or vice versa) depending on desired precedence.

### Language-Specific Notes

**Rust:**
- Both `Type::new()` calls and `Type { ... }` literals are constructors
- Query must capture both patterns

**Python:**
- Constructor is just a regular call to class name
- Indistinguishable from function call at query level
- Relies on class name being capitalized (heuristic)
