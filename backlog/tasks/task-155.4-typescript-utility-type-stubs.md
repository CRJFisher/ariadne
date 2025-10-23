# Task 155.4: TypeScript Utility Type Stubs

**Parent**: task-155
**Dependencies**: task-155.1, task-155.2, task-155.3
**Status**: TODO
**Priority**: Medium
**Estimated Effort**: 0.5 day

## Goal

Create type stubs for TypeScript utility types that affect property access patterns and type transformations.

## Scope

TypeScript has built-in utility types that transform object types. While we can't do full type-level computation, we can handle common patterns:

**In Scope**:
- `Pick<T, K>` - Select properties
- `Omit<T, K>` - Exclude properties
- `Partial<T>` - Make all properties optional
- `Required<T>` - Make all properties required
- `Record<K, V>` - Create object type
- `Readonly<T>` - Make properties readonly
- `Exclude<T, U>` - Remove types from union
- `Extract<T, U>` - Extract types from union
- `NonNullable<T>` - Remove null/undefined

**Out of Scope** (too complex for stubs):
- `ReturnType<T>` - Would need function signature tracking
- `Parameters<T>` - Would need function signature tracking
- Complex conditional types
- Mapped types with computed keys

## Stub File Location

Create: `type_stubs/typescript.json`

This extends JavaScript stubs, so it should include JavaScript stubs plus TypeScript-specific ones.

## Stub Definitions

### Basic Utility Types

```json
{
  "language": "typescript",
  "extends": "javascript",
  "stubs": {
    "Pick": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "identity"
        }
      },
      "note": "Pick<T, K> returns a subset of T, but we treat it as T for property access"
    },
    "Omit": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "identity"
        }
      },
      "note": "Omit<T, K> returns T without certain keys, but we treat it as T"
    },
    "Partial": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "identity"
        }
      },
      "note": "Partial<T> makes properties optional but doesn't change the base type"
    },
    "Required": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "identity"
        }
      },
      "note": "Required<T> makes properties required but doesn't change the base type"
    },
    "Readonly": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "identity"
        }
      },
      "note": "Readonly<T> makes properties readonly but doesn't change the base type"
    },
    "NonNullable": {
      "infer_rules": {
        "return": {
          "from": "call_argument:0",
          "transform": "remove_null_undefined"
        }
      }
    },
    "Record": {
      "infer_rules": {
        "return": {
          "from": "literal",
          "value": "object"
        }
      },
      "note": "Record<K, V> creates an object, but we can't infer specific properties"
    }
  }
}
```

### Type Usage in Code

These appear in type annotations, not runtime code:

```typescript
type UserInfo = Pick<User, 'name' | 'email'>;

const info: UserInfo = getUser();
info.getName();  // Should still resolve to User.getName()
```

## Implementation Notes

### Challenge: Type-Level vs Runtime

TypeScript utility types operate at the type level, not runtime:
- They don't create new classes/interfaces
- They transform existing types
- The runtime value is still the original type

**Our strategy**: Treat utility types as **identity transforms** for the base type:
- `Pick<User, 'name'>` → resolve as `User`
- `Partial<User>` → resolve as `User`
- `Omit<User, 'password'>` → resolve as `User`

This is imprecise (we don't track which properties are actually available), but it's better than no resolution.

### When This Matters

```typescript
// Factory returns utility type
function getPublicUser(): Pick<User, 'name' | 'email'> {
  return user;
}

const publicUser = getPublicUser();
publicUser.getName();  // Without stub: unresolved
                       // With stub: resolves to User.getName()
```

### Limitations

We won't catch errors like:
```typescript
const partial: Partial<User> = {};
partial.getName();  // We'll resolve this, but it might not exist at runtime
```

This is acceptable - we're doing call graph detection, not type checking.

## Transform Operations Needed

Add to `rule_evaluator.ts`:

```typescript
case "remove_null_undefined":
  // T | null | undefined → T
  return type.replace(/ \| null/g, '').replace(/ \| undefined/g, '');
```

## Testing

### Test Cases

```typescript
// Test 1: Pick utility type
type UserInfo = Pick<User, 'name' | 'email'>;
const info: UserInfo = getUser();
info.getName();  // Should resolve

// Test 2: Omit utility type
type PublicUser = Omit<User, 'password'>;
const pub: PublicUser = getUser();
pub.getName();  // Should resolve

// Test 3: Partial utility type
const updates: Partial<User> = {};
// (Property access would be undefined, but we don't track that)

// Test 4: NonNullable
type NotNull = NonNullable<User | null>;
const user: NotNull = getUser();
user.getName();  // Should resolve

// Test 5: Record (less useful, but test anyway)
const cache: Record<string, User> = {};
// Can't infer much here, but shouldn't crash
```

## Files to Create

1. `type_stubs/typescript.json` - TypeScript-specific stubs
2. `packages/core/src/resolve_references/type_stubs/typescript_stubs.test.ts` - Tests

## Files to Modify

1. `packages/core/src/resolve_references/type_stubs/rule_evaluator.ts`
   - Add `remove_null_undefined` transform
   - Add support for `extends` field in stub files (inherit JavaScript stubs)

## Acceptance Criteria

- [ ] All common utility types stubbed
- [ ] `extends` mechanism works (TypeScript inherits JavaScript stubs)
- [ ] Pick/Omit/Partial/Required resolve to base type
- [ ] NonNullable strips null/undefined
- [ ] Tests pass for all utility types
- [ ] Documentation explains limitations

## Priority Order

1. **Pick/Omit** - Most impactful for property access
2. **Partial/Required** - Common in APIs
3. **NonNullable** - Useful for null handling
4. **Others** - Nice to have

## Success Criteria

Common TypeScript patterns work:

```typescript
// API returns utility type
function getUser(): Omit<UserModel, 'password'> { ... }

const user = getUser();
user.getName();  // Resolves to UserModel.getName()
```

## Notes

- This is a "good enough" solution, not perfect type checking
- We're optimizing for call graph accuracy, not catching type errors
- Document clearly that we treat utility types as base types
- Consider adding `@ts-expect-error` examples in tests to show limitations
