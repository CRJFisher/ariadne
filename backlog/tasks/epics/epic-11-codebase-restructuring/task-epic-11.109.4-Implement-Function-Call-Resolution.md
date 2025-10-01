# Task 11.109.4: Implement Function Call Resolution

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 2-3 days
**Parent:** task-epic-11.109
**Dependencies:** task-epic-11.109.1 (ScopeResolver)

## Objective

Implement function call resolution using scope-aware lookup. This is the **simplest** resolver - it delegates all the heavy lifting to ScopeResolver.

## Implementation

### File Structure

```
packages/core/src/resolve_references/
└── call_resolution/
    ├── function_resolver.ts
    └── function_resolver.test.ts
```

### Core Implementation

```typescript
/**
 * Function Call Resolution
 *
 * Resolves function calls to their definitions using scope-aware lookup.
 * Delegates to ScopeResolver for the heavy lifting.
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

export type FunctionCallMap = Map<LocationKey, SymbolId>;

export function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  scope_resolver: ScopeResolver
): FunctionCallMap {
  const resolutions = new Map<LocationKey, SymbolId>();

  for (const [file_path, index] of indices) {
    // Filter for function call references
    const function_calls = index.references.filter(
      (ref) => ref.type === "call" && ref.call_type === "function"
    );

    for (const call_ref of function_calls) {
      // Resolve using scope walker - that's it!
      const resolved = scope_resolver.resolve_in_scope(
        call_ref.name,
        call_ref.scope_id
      );

      if (resolved) {
        const key = location_key(call_ref.location);
        resolutions.set(key, resolved);
      }
    }
  }

  return resolutions;
}
```

**That's the entire implementation!** Function resolution is now trivial because `ScopeResolver` handles all the complexity.

## Test Coverage

### Unit Tests (`function_resolver.test.ts`)

Test cases for each language:

#### Basic Function Calls
1. **Local function** - Call function in same file
   ```javascript
   function foo() {}
   foo();  // Resolves to local foo
   ```

2. **Imported function** - Call imported function
   ```javascript
   import { bar } from './utils';
   bar();  // Resolves to utils.bar
   ```

3. **Nested scope** - Call function from outer scope
   ```javascript
   function outer() {
     function inner() {}
     inner();  // Resolves to local inner
   }
   ```

#### Shadowing
4. **Local shadows import**
   ```javascript
   import { foo } from './utils';
   function foo() {}  // Local definition
   foo();  // Resolves to local foo, not import
   ```

5. **Inner shadows outer**
   ```javascript
   function foo() {
     function bar() {}
     function nested() {
       function bar() {}  // Shadows outer bar
       bar();  // Resolves to inner bar
     }
   }
   ```

#### Edge Cases
6. **Not found** - Call non-existent function returns null
7. **Closure** - Call function from closure
8. **Recursive** - Function calls itself

### Test Fixtures

Create minimal fixtures for each language:

#### JavaScript/TypeScript
```typescript
// test_fixtures/function_calls.ts
export function helper() {}

function main() {
  helper();  // Should resolve
  local();   // Should not resolve

  function local() {
    helper();  // Should resolve to imported helper
  }
}
```

#### Python
```python
# test_fixtures/function_calls.py
def helper():
    pass

def main():
    helper()  # Should resolve

    def local():
        helper()  # Should resolve to outer helper
```

#### Rust
```rust
// test_fixtures/function_calls.rs
fn helper() {}

fn main() {
    helper();  // Should resolve

    fn local() {
        helper();  // Should resolve to outer helper
    }
}
```

### Integration Tests

Test complete scenarios:
1. **Cross-file** - Import and call
2. **Multiple files** - Chain of imports
3. **Shadowing chain** - Multiple levels

## Success Criteria

### Functional
- ✅ Local function calls resolve correctly
- ✅ Imported function calls resolve correctly
- ✅ Shadowing handled correctly
- ✅ Not found returns null gracefully
- ✅ All 4 languages supported

### Testing
- ✅ Unit tests for basic cases
- ✅ Unit tests for shadowing
- ✅ Integration tests for cross-file
- ✅ All edge cases covered

### Code Quality
- ✅ Full JSDoc documentation
- ✅ Type-safe implementation
- ✅ Clear error handling
- ✅ Minimal code (leverages ScopeResolver)

## Technical Notes

### Reference Filtering

Filter for function calls:
```typescript
ref.type === "call" && ref.call_type === "function"
```

This excludes:
- Method calls (`call_type === "method"`)
- Constructor calls (`call_type === "constructor"`)
- Super calls (`call_type === "super"`)

### CallReference Structure

```typescript
interface SymbolReference {
  location: Location;
  type: ReferenceType;  // "call"
  call_type?: "function" | "method" | "constructor" | "super";
  name: SymbolName;
  scope_id: ScopeId;
  // ... other fields
}
```

### Resolution Flow

```
1. Filter references: type=call, call_type=function
2. For each call:
   a. Extract name and scope_id
   b. Call scope_resolver.resolve_in_scope(name, scope_id)
   c. Store: location_key -> resolved_symbol_id
3. Return map
```

## Performance

- O(n) where n = number of function calls
- Each resolution is O(scope_depth) via ScopeResolver
- Typical performance: ~1ms per 100 calls

## Known Limitations

None - function resolution is complete and correct with scope walking.

## Dependencies

**Uses:**
- `ScopeResolver` for name resolution
- `SemanticIndex.references` for call references
- `location_key` for map keys

**Consumed by:**
- Task 11.109.7 (Main orchestration)

## Next Steps

After completion:
- Method resolver (11.109.5) follows similar pattern
- Constructor resolver (11.109.6) follows similar pattern
- All resolvers integrated in 11.109.7
