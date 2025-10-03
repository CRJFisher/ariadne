# Task epic-11.112.7: Fix JavaScript Class Scopes

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 1-2 hours
**Files:** 1 file modified
**Dependencies:** tasks epic-11.112.5-6

## Objective

Update JavaScript class definitions to use `get_defining_scope_id()` instead of `get_scope_id()` to fix scope assignment bug.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`

## Implementation Steps

### 1. Locate Class Definition Handler (10 min)

Find the handler for `@definition.class`:

```typescript
{
  name: "definition.class",
  handler: (capture, context, builder) => {
    const class_id = class_symbol(capture.text, capture.location.file_path, capture.location);

    builder.add_class({
      symbol_id: class_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),  // ← CHANGE THIS
      // ...
    });
  }
}
```

### 2. Apply Fix (5 min)

```typescript
scope_id: context.get_defining_scope_id(capture.location),  // ← FIXED
```

### 3. Check for Other Class Handlers (10 min)

Search for any other class-related definitions:
```bash
grep -n "add_class" packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts
```

Apply fix to all.

### 4. Run Tests (15 min)

```bash
npm test -- semantic_index.javascript.test.ts
```

Expected: Tests pass.

### 5. Manual Verification (30 min)

Test with example code:
```javascript
class MyClass {
  method() {
    const x = 1;
  }
}
```

Build semantic index and verify:
- `MyClass.scope_id === file_scope` ✓
- Not `method_scope` ❌

## Success Criteria

- ✅ JavaScript class definitions use `get_defining_scope_id()`
- ✅ Tests pass
- ✅ Manual verification confirms fix

## Next Task

**task-epic-11.112.8** - Fix TypeScript class scopes
