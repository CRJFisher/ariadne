# Task 11.105.1: Extract Type Annotations

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 1-2 hours
**Parent:** task-epic-11.105
**Dependencies:** None

## Objective

Extract type names from explicit type annotations in variable declarations, parameter declarations, and function return types. Store as location → type name mappings.

## Implementation

### File

`packages/core/src/index_single_file/type_preprocessing/type_bindings.ts`

### Core Function

```typescript
import type { LocationKey, SymbolName } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { BuilderResult } from "../definitions/definition_builder";

/**
 * Extract type annotations from definitions
 *
 * Extracts type names from:
 * - Variable declarations: const x: User
 * - Parameter declarations: function f(x: User)
 * - Return type annotations: function f(): User
 *
 * Note: This extracts type NAMES (strings), not resolved SymbolIds.
 * Resolution happens in task 11.109.3 using ScopeResolver.
 */
export function extract_type_annotations(
  definitions: BuilderResult
): Map<LocationKey, SymbolName> {
  const bindings = new Map<LocationKey, SymbolName>();

  // 1. Extract from variable definitions
  for (const [var_id, var_def] of definitions.variables) {
    if (var_def.type) {
      const key = location_key(var_def.location);
      bindings.set(key, var_def.type);
    }
  }

  // 2. Extract from function parameters
  for (const [func_id, func_def] of definitions.functions) {
    for (const param of func_def.signature.parameters) {
      if (param.type) {
        const key = location_key(param.location);
        bindings.set(key, param.type);
      }
    }
  }

  // 3. Extract from class method parameters
  for (const [class_id, class_def] of definitions.classes) {
    for (const method of class_def.methods) {
      for (const param of method.parameters) {
        if (param.type) {
          const key = location_key(param.location);
          bindings.set(key, param.type);
        }
      }
    }

    // Constructor parameters
    if (class_def.constructor) {
      for (const ctor of class_def.constructor) {
        for (const param of ctor.parameters) {
          if (param.type) {
            const key = location_key(param.location);
            bindings.set(key, param.type);
          }
        }
      }
    }
  }

  // 4. Extract from interface method parameters
  for (const [iface_id, iface_def] of definitions.interfaces) {
    for (const method of iface_def.methods) {
      for (const param of method.parameters) {
        if (param.type) {
          const key = location_key(param.location);
          bindings.set(key, param.type);
        }
      }
    }
  }

  return bindings;
}
```

## Test Coverage

### Test File

`type_preprocessing/tests/type_bindings.test.ts`

### Test Cases

#### TypeScript
```typescript
test("extracts variable type annotations", () => {
  const code = `
    class User {}
    const user: User = getUser();
    let count: number = 0;
  `;

  const bindings = extract_type_annotations(definitions);

  // Should extract User type for user variable
  expect(bindings.get(user_location)).toBe("User");
  // Should extract number type for count variable
  expect(bindings.get(count_location)).toBe("number");
});

test("extracts parameter type annotations", () => {
  const code = `
    class User {}
    function processUser(user: User, id: number) {}
  `;

  const bindings = extract_type_annotations(definitions);

  expect(bindings.get(param_user_location)).toBe("User");
  expect(bindings.get(param_id_location)).toBe("number");
});

test("extracts method parameter annotations", () => {
  const code = `
    class Service {
      processUser(user: User) {}
    }
  `;

  const bindings = extract_type_annotations(definitions);
  expect(bindings.get(method_param_location)).toBe("User");
});

test("handles optional parameters", () => {
  const code = `
    function f(x?: User) {}
  `;

  const bindings = extract_type_annotations(definitions);
  expect(bindings.get(param_location)).toBe("User");
});
```

#### Python
```python
test("extracts Python type hints", () => {
  const code = `
    def process_user(user: User, count: int) -> str:
        pass
  `;

  const bindings = extract_type_annotations(definitions);

  expect(bindings.get(user_param_location)).toBe("User");
  expect(bindings.get(count_param_location)).toBe("int");
});
```

#### JavaScript (JSDoc)
```javascript
test("extracts JSDoc type annotations", () => {
  const code = `
    /**
     * @param {User} user
     * @param {number} count
     */
    function processUser(user, count) {}
  `;

  // Note: This requires JSDoc parsing in tree-sitter queries
  // May be deferred if complex
});
```

#### Rust
```rust
test("extracts Rust type annotations", () => {
  const code = `
    fn process_user(user: User, count: i32) -> String {}
  `;

  const bindings = extract_type_annotations(definitions);

  expect(bindings.get(user_param_location)).toBe("User");
  expect(bindings.get(count_param_location)).toBe("i32");
});
```

### Edge Cases

- Empty type annotations (skip)
- Complex types like `Array<User>` (store full string)
- Union types `User | Admin` (store full string)
- Nullable types `User?` or `User | null` (store full string)

**Note:** Complex type parsing is NOT required. Store the full type expression string as-is. Resolution in 11.109.3 will handle simple cases first.

## Success Criteria

### Functional
- ✅ Variable annotations extracted
- ✅ Parameter annotations extracted (functions, methods, constructors)
- ✅ All 4 languages supported (TS, Python, Rust; JS deferred)
- ✅ Handles optional parameters

### Testing
- ✅ Unit tests for each language
- ✅ Edge cases covered
- ✅ >90% code coverage

### Code Quality
- ✅ Clear JSDoc comments
- ✅ Type-safe implementation
- ✅ Pythonic naming

## Dependencies

**Uses:**
- `BuilderResult` from definition_builder
- `LocationKey`, `SymbolName` from types

**No external dependencies**

## Next Steps

After completion:
- Task 11.105.2 extracts constructor bindings
- Both merged in task 11.105.5
- Used by 11.109.3 for type resolution

## Technical Notes

### Return Types

Return type annotations are NOT extracted here because:
- They're not variable bindings
- They're used for function call resolution, not variable type tracking
- May be added in future if needed for call result type inference

### Type Expression Complexity

For complex types like `Map<string, User>`, store the full string:
- 11.109.3 will attempt resolution
- Initial implementation only resolves simple type names
- Complex generic types deferred to future work
