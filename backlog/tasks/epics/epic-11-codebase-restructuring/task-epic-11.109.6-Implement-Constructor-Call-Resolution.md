# Task 11.109.6: Implement Constructor Call Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3-4 days
**Parent:** task-epic-11.109
**Dependencies:**
- task-epic-11.109.1 (ScopeResolver)
- task-epic-11.109.3 (TypeContext)

## Objective

Implement constructor call resolution using scope-aware class name lookup and type validation. Similar to method resolution but simpler since the target is the class itself, not a member.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── call_resolution/
    ├── constructor_resolver.ts
    └── tests/
        └── constructor_resolver.test.ts
```

### Core Implementation

```typescript
/**
 * Constructor Call Resolution
 *
 * Resolves constructor calls by:
 * 1. Resolving the class name (scope-aware)
 * 2. Looking up the constructor definition
 * 3. Validating it's actually a constructible class
 */

import type {
  SymbolId,
  LocationKey,
  FilePath,
  SymbolReference,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolver } from "../core/scope_resolver";
import type { TypeContext } from "../type_resolution/type_context";

export type ConstructorCallMap = Map<LocationKey, SymbolId>;

export function resolve_constructor_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver,
  type_context: TypeContext
): ConstructorCallMap {
  const resolutions = new Map<LocationKey, SymbolId>();

  for (const [file_path, index] of indices) {
    // Filter for constructor call references
    const constructor_calls = index.references.filter(
      (ref) => ref.type === "call" && ref.call_type === "constructor"
    );

    for (const call_ref of constructor_calls) {
      const resolved = resolve_single_constructor_call(
        call_ref,
        index,
        scope_resolver,
        type_context
      );

      if (resolved) {
        const key = location_key(call_ref.location);
        resolutions.set(key, resolved);
      }
    }
  }

  return resolutions;
}

function resolve_single_constructor_call(
  call_ref: SymbolReference,
  index: SemanticIndex,
  scope_resolver: ScopeResolver,
  type_context: TypeContext
): SymbolId | null {
  // Step 1: Resolve class name to class symbol (scope-aware)
  const class_symbol = scope_resolver.resolve_in_scope(
    call_ref.name,
    call_ref.scope_id
  );
  if (!class_symbol) return null;

  // Step 2: Verify it's actually a class
  const class_def = find_class_definition(class_symbol, index);
  if (!class_def) return null;

  // Step 3: Get constructor symbol if exists
  // Options:
  // A) Return the class symbol itself (represents construction)
  // B) Return the explicit constructor definition if available
  // C) Return both (constructor references the class)

  // Option B: Return explicit constructor if defined
  if (class_def.constructor && class_def.constructor.length > 0) {
    return class_def.constructor[0].symbol_id;
  }

  // Option A: Return class symbol (implicit constructor)
  return class_symbol;
}

function find_class_definition(
  symbol_id: SymbolId,
  index: SemanticIndex
): ClassDefinition | null {
  return index.classes.get(symbol_id) || null;
}
```

## Resolution Steps

### Step 1: Resolve Class Name

Given: `new User()`
- Class name: `User`

Resolve using ScopeResolver:
```typescript
const class_symbol = scope_resolver.resolve_in_scope(
  "User",
  call_ref.scope_id
);
```

This respects scoping:
- Finds local class definitions
- Finds imported classes
- Handles shadowing correctly

### Step 2: Verify It's a Class

Check that the resolved symbol is actually a class:
```typescript
const class_def = index.classes.get(class_symbol);
```

This prevents resolving functions/variables as constructors.

### Step 3: Get Constructor Symbol

Return the appropriate symbol:
- If explicit constructor exists: return constructor symbol
- Otherwise: return class symbol (implicit constructor)

## Language-Specific Handling

### JavaScript/TypeScript
```typescript
// Explicit constructor
class User {
  constructor(name: string) { }
}
new User("Alice");  // Resolves to User.constructor

// Implicit constructor
class Helper { }
new Helper();  // Resolves to Helper (class symbol)
```

### Python
```python
# __init__ method
class User:
    def __init__(self, name):
        pass

user = User("Alice")  # Resolves to User.__init__

# No __init__
class Helper:
    pass

helper = Helper()  # Resolves to Helper (class symbol)
```

### Rust
```rust
// Struct construction (no explicit constructor)
struct User {
    name: String,
}

let user = User { name: "Alice".to_string() };
// Resolves to User (struct symbol)

// impl with new() method
impl User {
    fn new(name: String) -> User {
        User { name }
    }
}

let user = User::new("Alice".to_string());
// This is a static method call, not constructor
```

## Test Coverage

### Unit Tests (`constructor_resolver.test.ts`)

Test cases for each language:

#### Basic Construction
1. **Explicit constructor** - Class with constructor method
   ```typescript
   class User {
     constructor(name: string) { }
   }
   new User("Alice");  // Resolves to constructor
   ```

2. **Implicit constructor** - Class without explicit constructor
   ```typescript
   class Helper { }
   new Helper();  // Resolves to class
   ```

3. **Python __init__**
   ```python
   class User:
       def __init__(self, name):
           pass
   user = User("Alice")  # Resolves to __init__
   ```

#### Class Resolution
4. **Local class** - Constructor of locally defined class
5. **Imported class** - Constructor of imported class
6. **Nested class** - Constructor of nested/inner class

#### Shadowing
7. **Class shadows import**
   ```typescript
   import { User } from './types';
   class User { }  // Local class
   new User();  // Resolves to local class
   ```

8. **Inner class shadows outer**
   ```typescript
   class Outer {
     class Inner { }
   }
   class Test {
     class Inner { }  // Different Inner
     test() {
       new Inner();  // Resolves to Test.Inner
     }
   }
   ```

#### Edge Cases
9. **Not a class** - Try to construct a function/variable
10. **Class not found** - Constructor call with unknown class
11. **Generic class** - Constructor with type parameters
12. **Abstract class** - Constructor of abstract class (allowed in definition)

#### Assignment Tracking
13. **Constructor assignment** - `const x = new User()`
14. **Property assignment** - `this.user = new User()`
15. **Chained construction** - `new Outer(new Inner())`

### Test Fixtures

#### TypeScript
```typescript
class User {
  constructor(public name: string) { }
}

class Helper { }  // No explicit constructor

function test() {
  const user = new User("Alice");  // Should resolve
  const helper = new Helper();  // Should resolve

  class LocalUser {
    constructor() { }
  }
  const local = new LocalUser();  // Should resolve to local
}
```

#### Python
```python
class User:
    def __init__(self, name):
        self.name = name

class Helper:
    pass

def test():
    user = User("Alice")  # Should resolve
    helper = Helper()  # Should resolve
```

#### Rust
```rust
struct User {
    name: String,
}

struct Helper;

fn test() {
    let user = User { name: "Alice".to_string() };  // Should resolve
    let helper = Helper;  // Should resolve
}
```

## Success Criteria

### Functional
- ✅ Class name resolved using scope walking
- ✅ Explicit constructors resolved
- ✅ Implicit constructors handled (return class symbol)
- ✅ Non-class symbols rejected
- ✅ Shadowing handled correctly
- ✅ All 4 languages supported

### Testing
- ✅ Unit tests for explicit/implicit constructors
- ✅ Unit tests for class resolution
- ✅ Unit tests for shadowing
- ✅ Integration tests for cross-file
- ✅ Edge cases covered

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Consistent with function/method resolvers

## Technical Notes

### Reference Context

Constructor calls have construct_target:
```typescript
interface ReferenceContext {
  construct_target?: Location;  // Variable being assigned to
}
```

This is used by TypeContext to track variable types:
```typescript
const user = new User();
// construct_target points to 'user'
// TypeContext stores: user -> User type
```

### Constructor vs Class Symbol

**Design decision:** Return constructor symbol when available, class symbol otherwise.

**Rationale:**
- Constructors may have different signatures
- Explicit constructors are distinct symbols
- Enables constructor-specific analysis (parameters, decorators)

**Alternative:** Always return class symbol
- Simpler
- Loses constructor-specific information

### Generic Classes

```typescript
class Box<T> {
  constructor(value: T) { }
}

new Box<string>("hello");
```

**Initial implementation:** Ignore type parameters
**Future:** Track type arguments

### Performance

- O(n) where n = number of constructor calls
- Each call: O(scope_depth) + O(1) class lookup
- Typical: ~1ms per 100 calls

## Known Limitations

Document for future work:

1. **No type parameters** - Generic arguments ignored
2. **No overloaded constructors** - First/only constructor returned
3. **No factory detection** - Factory functions not tracked
4. **No super() resolution** - Super constructor calls not handled
5. **Rust struct literals** - Treated as constructor calls (may differ)

## Dependencies

**Uses:**
- `ScopeResolver` for class name resolution
- `TypeContext` for validation
- `SemanticIndex.references` for constructor calls
- `SemanticIndex.classes` for class definitions

**Consumed by:**
- Task 11.109.7 (Main orchestration)
- TypeContext uses results for type tracking

## Integration with TypeContext

Constructor resolution **feeds** TypeContext:

```typescript
// Constructor call: const user = new User()
// 1. Resolve constructor → User class
// 2. Extract construct_target → location of 'user' variable
// 3. TypeContext stores: user -> User type
// 4. Later method calls use this: user.getName() → User.getName
```

This is a **bidirectional relationship**:
- Constructor resolver uses TypeContext for validation
- TypeContext uses constructor resolutions for type tracking

## Next Steps

After completion:
- All three call resolvers complete
- Main orchestration (11.109.7) integrates them
- TypeContext can leverage constructor tracking
