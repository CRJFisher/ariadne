# Task 11.105.4: Extract Type Alias Metadata

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 30 minutes
**Parent:** task-epic-11.105
**Dependencies:** None

## Objective

Extract raw `type_expression` strings from TypeAliasDefinition. **Do NOT resolve** these to SymbolIds - that requires scope-aware lookup and will be done by task 11.109.3 using ScopeResolver.

## Background

Type aliases can reference imported types, requiring import resolution:

```typescript
// file1.ts
export class User {}

// file2.ts
import { User } from './file1';
type MyUser = User;  // Resolving "User" requires import resolution!
```

This task extracts `"User"` as a string. Task 11.109.3 will resolve it to User's SymbolId using ScopeResolver (which handles imports).

## Implementation

### File

`packages/core/src/index_single_file/type_preprocessing/alias_extraction.ts`

### Core Function

```typescript
import type { SymbolId } from "@ariadnejs/types";
import type { TypeAliasDefinition } from "@ariadnejs/types";

/**
 * Extract type alias metadata from definitions
 *
 * Extracts raw type_expression strings from type aliases.
 * Does NOT resolve type names to SymbolIds - that requires
 * scope-aware lookup and happens in task 11.109.3.
 *
 * Examples:
 * - type UserId = string → {UserId id → "string"}
 * - type MyUser = User → {MyUser id → "User"}
 *
 * The string "User" will be resolved to User class SymbolId
 * in task 11.109.3 using ScopeResolver (which handles imports).
 */
export function extract_type_alias_metadata(
  type_defs: ReadonlyMap<SymbolId, TypeAliasDefinition>
): Map<SymbolId, string> {
  const metadata = new Map<SymbolId, string>();

  for (const [alias_id, type_alias] of type_defs) {
    // Extract raw type_expression string
    if (type_alias.type_expression) {
      metadata.set(alias_id, type_alias.type_expression);
    }
  }

  return metadata;
}
```

## Test Coverage

### Test File

`type_preprocessing/tests/alias_extraction.test.ts`

### Test Cases

#### TypeScript
```typescript
test("extracts simple type alias", () => {
  const code = `
    type UserId = string;
    type Count = number;
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  expect(metadata.get(userid_id)).toBe("string");
  expect(metadata.get(count_id)).toBe("number");
});

test("extracts class alias (not resolved)", () => {
  const code = `
    class User {}
    type MyUser = User;
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  // Should store "User" string, NOT User class SymbolId
  expect(metadata.get(myuser_id)).toBe("User");
});

test("extracts imported type alias (not resolved)", () => {
  const code = `
    import { User } from './user';
    type MyUser = User;
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  // Should store "User" string
  // Resolution to imported User happens in 11.109.3
  expect(metadata.get(myuser_id)).toBe("User");
});

test("handles complex type expressions", () => {
  const code = `
    type UserMap = Map<string, User>;
    type Optional<T> = T | null;
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  // Store full expression as string
  expect(metadata.get(usermap_id)).toBe("Map<string, User>");
  expect(metadata.get(optional_id)).toContain("T | null");
});

test("skips aliases without type_expression", () => {
  // Some languages may have aliases without explicit expressions
  const metadata = extract_type_alias_metadata(type_defs);

  // Should not include entries with undefined type_expression
  expect(metadata.has(incomplete_alias_id)).toBe(false);
});
```

#### Python (Type Aliases)
```python
test("extracts Python type aliases", () => {
  const code = `
    from typing import List
    UserList = List[User]
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  expect(metadata.get(userlist_id)).toBe("List[User]");
});
```

#### Rust (Type Aliases)
```rust
test("extracts Rust type aliases", () => {
  const code = `
    type UserId = i32;
    type Result<T> = std::result::Result<T, Error>;
  `;

  const metadata = extract_type_alias_metadata(type_defs);

  expect(metadata.get(userid_id)).toBe("i32");
  expect(metadata.get(result_id)).toContain("std::result::Result");
});
```

### Important Test Cases

**Cross-file alias (demonstrates why resolution is in 11.109.3):**

```typescript
// user.ts
export class User {
  getName() { return ""; }
}

// types.ts
import { User } from './user';
type MyUser = User;

// app.ts
import { MyUser } from './types';
const user: MyUser = getUser();
user.getName();  // Should resolve to User.getName
```

For this to work:
1. Task 11.105.4 extracts: `{MyUser id → "User"}`
2. Task 11.109.3 resolves: `"User"` → User class SymbolId (via import resolution)
3. Task 11.109.5 resolves: `user.getName()` → User.getName

## Success Criteria

### Functional
- ✅ Simple aliases extracted
- ✅ Complex type expressions stored as strings
- ✅ Does NOT attempt resolution
- ✅ All languages with type aliases supported

### Testing
- ✅ Unit tests for simple cases
- ✅ Complex type expressions
- ✅ Cross-file reference examples
- ✅ >90% code coverage

### Code Quality
- ✅ Clear JSDoc explaining NO resolution
- ✅ Simple implementation (just string extraction)
- ✅ Well-documented why resolution is deferred

## Dependencies

**Uses:**
- `TypeAliasDefinition` from types

**No external dependencies**

## Next Steps

After completion:
- Task 11.105.5 adds this to SemanticIndex
- Task 11.109.3 resolves type_expression strings to SymbolIds
- Task 11.109.3 uses ScopeResolver for resolution (handles imports!)

## Technical Notes

### Why Not Resolve Here?

Type alias resolution requires:
1. **Scope-aware lookup** - respects local shadowing
2. **Import resolution** - resolves imported type names
3. **Cross-file context** - may reference types from other files

Example showing why scope awareness is needed:

```typescript
class User {}

function test() {
  type User = string;  // Shadows outer User
  type MyUser = User;  // Should resolve to string, not class
}
```

Task 11.109.1's ScopeResolver handles this correctly.

### Generic Type Expressions

For generic types like `Map<string, User>`:
- Store the full string as-is
- Task 11.109.3 will attempt basic resolution
- Complex generic parsing is future work

Initial 11.109.3 implementation may only resolve simple type names:
- `"User"` → resolves
- `"Map<string, User>"` → may defer or resolve partially

### type_expression Field

The `type_expression` field in TypeAliasDefinition comes from tree-sitter:

**TypeScript pattern:**
```scheme
(type_alias_declaration
  name: (type_identifier) @type.name
  value: (_) @type.expression)
```

The `@type.expression` node's text becomes `type_expression`.
