# Task epic-11.112.10: Fix TypeScript Enum Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1 hour
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.9

## Objective

Update TypeScript enum definitions to use `get_defining_scope_id()` to fix scope assignment bug.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

## Implementation Steps

### 1. Locate Enum Definition Handler (10 min)

Find the handler for `@definition.enum`:

```typescript
{
  name: "definition.enum",
  handler: (capture, context, builder) => {
    const enum_id = /* ... */;

    builder.add_enum({
      symbol_id: enum_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      is_const: is_const_enum(capture.node),
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Verify All Enum Handlers (10 min)

Check for both regular and const enums:
```bash
grep -n "add_enum\|is_const_enum" packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts
```

### 4. Run Tests (10 min)

```bash
npm test -- semantic_index.typescript.test.ts
```

### 5. Manual Verification (20 min)

Test with enum:
```typescript
enum Color {
  Red,
  Green,
  Blue
}

const enum Direction {
  North,
  South,
  East,
  West
}

function getColor(): Color {
  return Color.Red;
}
```

Verify:
- `Color.scope_id === file_scope` ✓
- `Direction.scope_id === file_scope` ✓

## Success Criteria

- ✅ Enum definitions use `get_defining_scope_id()`
- ✅ Both regular and const enums fixed
- ✅ Tests pass
- ✅ Manual verification confirms fix

## Outputs

- Fixed enum scope assignment in `typescript_builder_config.ts`

## Next Task

**task-epic-11.112.11** - Fix Python class scopes
