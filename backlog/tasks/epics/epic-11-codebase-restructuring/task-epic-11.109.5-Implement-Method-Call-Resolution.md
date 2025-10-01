# Task 11.109.5: Implement Method Call Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 4-5 days
**Parent:** task-epic-11.109
**Dependencies:**
- task-epic-11.109.1 (ScopeResolver)
- task-epic-11.109.3 (TypeContext)

## Objective

Implement method call resolution by combining scope-aware receiver resolution with type-based member lookup. More complex than function resolution due to type dependency.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── call_resolution/
    ├── method_resolver.ts
    └── tests/
        └── method_resolver.test.ts
```

### Core Implementation

```typescript
/**
 * Method Call Resolution
 *
 * Resolves method calls by:
 * 1. Resolving the receiver object (scope-aware)
 * 2. Determining the receiver's type (from TypeContext)
 * 3. Looking up the method on that type
 */

import type {
  SymbolId,
  LocationKey,
  FilePath,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolver } from "../core/scope_resolver";
import type { TypeContext } from "../type_resolution/type_context";

export type MethodCallMap = Map<LocationKey, SymbolId>;

export function resolve_method_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver,
  type_context: TypeContext
): MethodCallMap {
  const resolutions = new Map<LocationKey, SymbolId>();

  for (const [file_path, index] of indices) {
    // Filter for method call references
    const method_calls = index.references.filter(
      (ref) => ref.type === "call" && ref.call_type === "method"
    );

    for (const call_ref of method_calls) {
      const resolved = resolve_single_method_call(
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

function resolve_single_method_call(
  call_ref: SymbolReference,
  index: SemanticIndex,
  scope_resolver: ScopeResolver,
  type_context: TypeContext
): SymbolId | null {
  // Extract receiver location from context
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) return null;

  // Step 1: Resolve receiver to its symbol (scope-aware)
  const receiver_name = extract_receiver_name(call_ref);
  const receiver_symbol = scope_resolver.resolve_in_scope(
    receiver_name,
    call_ref.scope_id
  );
  if (!receiver_symbol) return null;

  // Step 2: Get receiver's type from type context
  const receiver_type = type_context.get_symbol_type(receiver_symbol);
  if (!receiver_type) return null;

  // Step 3: Look up method on that type
  const method_symbol = type_context.get_type_member(
    receiver_type,
    call_ref.name
  );

  return method_symbol;
}

function extract_receiver_name(call_ref: SymbolReference): SymbolName {
  // Get first element of property chain or use name
  const chain = call_ref.context?.property_chain;
  return ((chain && chain[0]) || call_ref.name) as SymbolName;
}
```

## Resolution Steps

### Step 1: Resolve Receiver Symbol

Given: `user.getName()`
- Receiver: `user`
- Method: `getName`

Resolve `user` using ScopeResolver:
```typescript
const receiver_symbol = scope_resolver.resolve_in_scope(
  "user",
  call_ref.scope_id
);
```

This respects scoping rules - finds the closest `user` definition.

### Step 2: Determine Receiver Type

Once we have the receiver symbol, get its type:
```typescript
const receiver_type = type_context.get_symbol_type(receiver_symbol);
```

This uses TypeContext's type tracking:
- Check variable type annotation: `const user: User`
- Check constructor assignment: `const user = new User()`
- Check return type: `const user = getUser()` where `getUser(): User`

### Step 3: Lookup Method on Type

Finally, find the method on the type:
```typescript
const method_symbol = type_context.get_type_member(
  receiver_type,
  "getName"
);
```

This searches the class/interface for the method member.

## Test Coverage

### Unit Tests (`method_resolver.test.ts`)

Test cases for each language:

#### Basic Method Calls
1. **Instance method** - Call method on instance variable
   ```typescript
   const obj = new MyClass();
   obj.method();  // Resolves to MyClass.method
   ```

2. **Annotated variable**
   ```typescript
   const obj: MyClass = factory();
   obj.method();  // Resolves to MyClass.method
   ```

3. **Constructor assignment**
   ```python
   obj = MyClass()
   obj.method()  # Resolves to MyClass.method
   ```

#### Receiver Resolution
4. **Local receiver** - Receiver defined locally
5. **Parameter receiver** - Receiver is function parameter
6. **Imported receiver** - Receiver imported from another file
7. **This/self receiver** - `this.method()` or `self.method()`

#### Type Tracking
8. **Explicit annotation** - `const x: Type = ...`
9. **Constructor tracking** - `const x = new Type()`
10. **Return type tracking** - `const x = factory()` where `factory(): Type`

#### Shadowing
11. **Receiver shadowing** - Inner scope receiver shadows outer
12. **Same method different types**
    ```typescript
    const a = new TypeA();
    const b = new TypeB();
    a.method();  // TypeA.method
    b.method();  // TypeB.method
    ```

#### Method Chains
13. **Simple chain** - `obj.getHelper().process()`
14. **Long chain** - Multiple method calls chained

#### Edge Cases
15. **Receiver not found** - Return null gracefully
16. **Type not found** - Receiver has no tracked type
17. **Method not found** - Type doesn't have the method
18. **Static methods** - Class static method calls

### Test Fixtures

#### TypeScript
```typescript
class User {
  getName(): string { return ""; }
}

function test() {
  const user: User = new User();
  user.getName();  // Should resolve to User.getName

  function nested() {
    const user = "string";  // Shadows outer user
    // user.getName(); would be invalid
  }
}
```

#### Python
```python
class User:
    def get_name(self):
        pass

def test():
    user = User()
    user.get_name()  # Should resolve to User.get_name
```

#### Rust
```rust
struct User {}
impl User {
    fn get_name(&self) -> String { String::new() }
}

fn test() {
    let user = User {};
    user.get_name();  // Should resolve to User::get_name
}
```

## Success Criteria

### Functional
- ✅ Receiver resolved using scope walking
- ✅ Receiver type determined from TypeContext
- ✅ Method looked up on receiver type
- ✅ Shadowing handled correctly
- ✅ All 4 languages supported

### Testing
- ✅ Unit tests for all resolution steps
- ✅ Unit tests for type tracking sources
- ✅ Unit tests for shadowing
- ✅ Integration tests for complete flows
- ✅ Edge cases covered

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Good separation of concerns

## Technical Notes

### Reference Context

Method calls have additional context:
```typescript
interface ReferenceContext {
  receiver_location?: Location;  // Location of receiver object
  property_chain?: readonly SymbolName[];  // For chained calls
}
```

### Method Chains

For `a.b.c()`:
- Property chain: `["a", "b", "c"]`
- Receiver: location of `a.b`
- Method: `c`

**Initial implementation:** Only resolve simple calls (single receiver)
**Future enhancement:** Full chain resolution

### Static vs Instance Methods

```typescript
// Instance method
obj.method();  // Receiver is variable

// Static method
MyClass.method();  // Receiver is class name
```

Both follow same pattern:
1. Resolve receiver (variable or class)
2. Get type (or use class directly)
3. Lookup method

### Performance

- O(n) where n = number of method calls
- Each call: O(scope_depth) + O(1) type lookup + O(1) member lookup
- Typical: ~2ms per 100 calls

## Known Limitations

Document for future work:

1. **No method chains** - Only single receiver resolution
2. **No inheritance** - Direct members only (depends on TypeContext)
3. **No interface resolution** - Concrete classes only initially
4. **No generic methods** - Generic parameters ignored
5. **No overloading** - First match wins

## Dependencies

**Uses:**
- `ScopeResolver` for receiver resolution
- `TypeContext` for type tracking and member lookup
- `SemanticIndex.references` for method calls

**Consumed by:**
- Task 11.109.7 (Main orchestration)

## Next Steps

After completion:
- Constructor resolver (11.109.6) follows similar pattern
- Can enhance with inheritance (after TypeContext update)
- Can enhance with method chains (future)
