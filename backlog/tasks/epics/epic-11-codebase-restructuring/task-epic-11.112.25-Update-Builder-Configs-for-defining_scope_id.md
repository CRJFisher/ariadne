# Task epic-11.112.25: Update Builder Configs for defining_scope_id

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2 hours
**Files:** 4 files modified
**Dependencies:** task-epic-11.112.24

## Objective

Update all language builder configs to use `defining_scope_id` instead of `scope_id` when creating definitions. This is a mechanical refactoring to match the renamed type field.

## Files

### MODIFIED
- `packages/core/src/index_single_file/query_code_tree/language_configs/javascript_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/typescript_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/python_builder_config.ts`
- `packages/core/src/index_single_file/query_code_tree/language_configs/rust_builder_config.ts`

## Implementation Steps

### 1. Update JavaScript Builder Config (30 min)

Find all instances where definitions are created:

```typescript
// Before:
builder.add_class({
  symbol_id: class_id,
  name: capture.text,
  location: capture.location,
  scope_id: context.get_defining_scope_id(capture.location),  // ← Rename
  availability: determine_availability(capture.node),
});

// After:
builder.add_class({
  symbol_id: class_id,
  name: capture.text,
  location: capture.location,
  defining_scope_id: context.get_defining_scope_id(capture.location),  // ← Renamed
  availability: determine_availability(capture.node),
});
```

Search and replace in file:
```bash
# Use sed or editor to replace
scope_id: context.get_defining_scope_id
→
defining_scope_id: context.get_defining_scope_id

scope_id: context.get_scope_id
→
defining_scope_id: context.get_scope_id
```

### 2. Update TypeScript Builder Config (30 min)

Same pattern - find all `add_*` calls:
- `add_class()`
- `add_interface()`
- `add_enum()`
- `add_function()`
- `add_variable()`
- `add_method()`

Replace `scope_id:` with `defining_scope_id:` in all.

### 3. Update Python Builder Config (30 min)

Same pattern - update all definition builders.

### 4. Update Rust Builder Config (30 min)

Same pattern - update all definition builders for structs, enums, etc.

### 5. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: Type errors should be gone in builder configs (but may remain in other files).

### 6. Run Tests (10 min)

```bash
npm test -- semantic_index.*.test.ts
```

Expected: Tests may fail if they check `.scope_id` - will be fixed in task-epic-11.112.26.

## Success Criteria

- ✅ All builder configs use `defining_scope_id`
- ✅ No more `scope_id` in builder config files
- ✅ Type checker passes for builder configs
- ✅ Code compiles

## Outputs

- Updated builder configs with consistent naming

## Next Task

**task-epic-11.112.26** - Update all code references to defining_scope_id
