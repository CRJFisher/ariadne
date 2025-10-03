# Task epic-11.112.26: Update All References to defining_scope_id

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 2-3 hours
**Files:** Multiple files modified
**Dependencies:** task-epic-11.112.25

## Objective

Update all code that accesses `.scope_id` on definitions to use `.defining_scope_id`. This completes the renaming refactor across the entire codebase.

## Files

### MODIFIED
- All files in `packages/core/src/resolve_references/`
- All test files
- Any other code that accesses definition objects

## Implementation Steps

### 1. Find All References (10 min)

```bash
# Find all .scope_id accesses
grep -r "\.scope_id" packages/core/src/ --include="*.ts" | grep -v "test.ts"

# Also check tests
grep -r "\.scope_id" packages/core/src/ --include="*.test.ts"
```

### 2. Update Symbol Resolution Code (30 min)

Update files in `resolve_references/` that access `.scope_id`:

```typescript
// Before:
const definition_scope = definition.scope_id;

// After:
const definition_scope = definition.defining_scope_id;
```

Likely files to update:
- `symbol_resolver_index.ts`
- `scope_resolver_index.ts`
- Any utility functions

### 3. Update Test Files (60 min)

Update all test files that assert on `.scope_id`:

```typescript
// Before:
expect(class_def.scope_id).toBe(index.root_scope_id);

// After:
expect(class_def.defining_scope_id).toBe(index.root_scope_id);
```

Files to update:
- `semantic_index.*.test.ts` (all languages)
- `symbol_resolution.*.test.ts` (all languages)
- `scope_assignment.test.ts` (created in task-epic-11.112.14)
- Any other integration tests

### 4. Update Type Utilities (20 min)

If there are any utility functions that work with definitions:

```typescript
// Before:
function get_definition_scope(def: FunctionDefinition): ScopeId {
  return def.scope_id;
}

// After:
function get_definition_scope(def: FunctionDefinition): ScopeId {
  return def.defining_scope_id;
}
```

### 5. Run Type Checker (10 min)

```bash
npx tsc --noEmit
```

Expected: All type errors resolved.

### 6. Run Full Test Suite (20 min)

```bash
npm test
```

Expected: All tests pass.

### 7. Search for Missed References (10 min)

Final verification:
```bash
# Should return no results in source code (may appear in comments)
grep -r "\.scope_id" packages/core/src/ --include="*.ts" | grep -v "//"
```

## Success Criteria

- ✅ All `.scope_id` references updated to `.defining_scope_id`
- ✅ Type checker passes
- ✅ All tests pass
- ✅ No missed references

## Outputs

- Fully migrated codebase using `defining_scope_id`

## Next Task

**task-epic-11.112.27** - Add VisibilityKind type definition
