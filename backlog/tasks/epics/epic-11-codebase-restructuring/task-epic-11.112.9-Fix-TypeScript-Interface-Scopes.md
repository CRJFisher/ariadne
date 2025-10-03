# Task epic-11.112.9: Fix TypeScript Interface Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.8

## Objective

Update TypeScript interface definitions to use `get_defining_scope_id()` to fix scope assignment bug where interfaces with method signatures get assigned to wrong scopes.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

## Implementation Steps

### 1. Locate Interface Definition Handler (10 min)

Find the handler for `@definition.interface`:

```typescript
{
  name: "definition.interface",
  handler: (capture, context, builder) => {
    const interface_id = type_symbol(capture.text, capture.location.file_path, capture.location);

    builder.add_interface({
      symbol_id: interface_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      extends: extends_clause,
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Verify No Other Interface Handlers (10 min)

```bash
grep -n "add_interface" packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts
```

Ensure all use `get_defining_scope_id()`.

### 4. Run TypeScript Semantic Tests (10 min)

```bash
npm test -- semantic_index.typescript.test.ts
```

### 5. Manual Verification (20 min)

Test with interface containing method signatures:
```typescript
interface IUser {
  getName(): string;
  setName(name: string): void;
}

function processUser(user: IUser) {
  const name = user.getName();
}
```

Verify:
- `IUser.scope_id === file_scope` ✓
- Not `getName_method_signature_scope` ❌

## Success Criteria

- ✅ Interface definitions use `get_defining_scope_id()`
- ✅ Tests pass
- ✅ Manual verification confirms interfaces in correct scope

## Outputs

- Fixed interface scope assignment in `typescript_builder_config.ts`

## Next Task

**task-epic-11.112.10** - Fix TypeScript enum scopes
