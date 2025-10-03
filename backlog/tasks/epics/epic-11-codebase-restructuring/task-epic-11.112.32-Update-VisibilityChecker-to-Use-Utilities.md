# Task epic-11.112.32: Update VisibilityChecker to Use Utilities

**Parent:** task-epic-11.112
**Status:** Not Started
**Estimated Time:** 30 min
**Files:** 1 file modified
**Dependencies:** task-epic-11.112.31

## Objective

Refactor VisibilityChecker to use the centralized scope tree utilities instead of duplicating traversal logic. This improves code reuse and maintainability.

## Files

### MODIFIED
- `packages/core/src/resolve_references/visibility_checker/visibility_checker.ts`

## Implementation Steps

### 1. Import Scope Tree Utilities (5 min)

```typescript
// At top of visibility_checker.ts
import { is_ancestor_of, same_file } from '../scope_tree_utils';
```

### 2. Refactor check_scope_children (5 min)

Replace internal `is_ancestor_of` method with utility:

```typescript
// Before:
private check_scope_children(
  definition: Definition,
  reference_scope_id: ScopeId
): boolean {
  if (definition.defining_scope_id === reference_scope_id) {
    return true;
  }

  return this.is_ancestor_of(
    definition.defining_scope_id,
    reference_scope_id
  );
}

// After:
private check_scope_children(
  definition: Definition,
  reference_scope_id: ScopeId
): boolean {
  if (definition.defining_scope_id === reference_scope_id) {
    return true;
  }

  return is_ancestor_of(
    definition.defining_scope_id,
    reference_scope_id,
    this.index
  );
}
```

### 3. Refactor check_file (5 min)

Use same_file utility:

```typescript
// Before:
private check_file(
  definition: Definition,
  reference_scope_id: ScopeId
): boolean {
  const reference_scope = this.index.scopes.get(reference_scope_id);
  if (!reference_scope) return false;

  return definition.location.file_path === reference_scope.location.file_path;
}

// After:
private check_file(
  definition: Definition,
  reference_scope_id: ScopeId
): boolean {
  const reference_scope = this.index.scopes.get(reference_scope_id);
  if (!reference_scope) return false;

  // Get the defining scope to use with same_file utility
  const defining_scope = this.index.scopes.get(definition.defining_scope_id);
  if (!defining_scope) return false;

  // Check if both scopes are in the same file
  return same_file(definition.defining_scope_id, reference_scope_id, this.index);
}
```

### 4. Remove Duplicate is_ancestor_of Method (5 min)

Delete the internal `is_ancestor_of` method from VisibilityChecker class:

```typescript
// DELETE THIS METHOD:
private is_ancestor_of(
  potential_ancestor: ScopeId,
  scope_id: ScopeId
): boolean {
  // ... implementation ...
}
```

### 5. Run Tests (5 min)

```bash
npm test -- visibility_checker.test.ts
```

Expected: All tests still pass (refactoring should not change behavior).

### 6. Run Type Checker (5 min)

```bash
npx tsc --noEmit
```

Expected: No type errors.

## Success Criteria

- ✅ VisibilityChecker uses scope tree utilities
- ✅ No duplicate traversal logic
- ✅ All tests pass
- ✅ Behavior unchanged (pure refactor)

## Outputs

- Refactored `visibility_checker.ts` using utilities

## Next Task

**task-epic-11.112.33** - Integrate VisibilityChecker into symbol resolution
