# Task epic-11.112.8: Fix TypeScript Class Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** tasks epic-11.112.5-6

## Objective

Update TypeScript class definitions (both regular and abstract) to use `get_defining_scope_id()` instead of `get_scope_id()` to fix scope assignment bug.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`

## Implementation Steps

### 1. Locate Regular Class Handler (10 min)

Find the handler for `@definition.class`:

```typescript
{
  name: "definition.class",
  handler: (capture, context, builder) => {
    const class_id = class_symbol(/* ... */);

    builder.add_class({
      symbol_id: class_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      availability: determine_availability(capture.node),
      extends: extends_clause,
      implements: implements_clause,
      generics: extract_type_parameters(capture.node),
    });
  }
}
```

### 2. Apply Fix to Regular Classes (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Locate Abstract Class Handler (10 min)

Find handler for abstract classes (might be same handler with different capture name or separate handler).

### 4. Apply Fix to Abstract Classes (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 5. Verify All Class Handlers Updated (10 min)

Search for all class-related handlers:
```bash
grep -n "add_class\|class_symbol" packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts
```

Ensure all use `get_defining_scope_id()`.

### 6. Run TypeScript Semantic Tests (15 min)

```bash
npm test -- semantic_index.typescript.test.ts
```

Expected: Tests pass (or some failures that will be fixed in task-epic-11.112.16).

### 7. Manual Verification (30 min)

Test with TypeScript code:
```typescript
class RegularClass {
  method() {
    const x = 1;
  }
}

abstract class AbstractClass {
  abstract abstractMethod(): void;

  concreteMethod() {
    const y = 2;
  }
}
```

Build semantic index and verify:
- `RegularClass.scope_id === file_scope` ✓
- `AbstractClass.scope_id === file_scope` ✓
- Neither points to method_scope ❌

## Success Criteria

- ✅ TypeScript regular class definitions use `get_defining_scope_id()`
- ✅ TypeScript abstract class definitions use `get_defining_scope_id()`
- ✅ Tests pass or show expected failures
- ✅ Manual verification confirms fix

## Outputs

- Updated `typescript_builder_config.ts` with correct scope assignment

## Next Task

**task-epic-11.112.9** - Fix TypeScript interface scopes
