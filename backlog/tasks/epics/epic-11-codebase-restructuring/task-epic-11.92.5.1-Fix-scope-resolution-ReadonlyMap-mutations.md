# Task: Fix scope_resolution ReadonlyMap Mutations

**Task ID**: task-epic-11.92.5.1
**Parent**: task-epic-11.92.5
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Fix 5 TypeScript errors in `function_resolution/scope_resolution.test.ts` where tests attempt to mutate readonly arrays using `.push()` method.

## Problem

The test file attempts to modify `readonly ScopeId[]` arrays directly, causing compilation errors:
- Line 355: `child_ids.push(scope2_id)`
- Line 356: `child_ids.push(scope3_id)`
- Line 357: `child_ids.push(scope4_id)`
- Line 546: `child_ids.push(nested_id)`
- Line 1051: `child_ids.push(child_id)`

## Solution Approach

1. **Option A: Create mutable copies**
   ```typescript
   const mutableChildIds = [...child_ids];
   mutableChildIds.push(scope2_id);
   ```

2. **Option B: Use spread operator for immutable update**
   ```typescript
   child_ids = [...child_ids, scope2_id];
   ```

3. **Option C: Update mock creation to use mutable arrays initially**
   ```typescript
   // In mock setup
   child_ids: [] as ScopeId[], // Not readonly during test setup
   ```

## Implementation Steps

1. Review each error location to understand the test intent
2. Choose appropriate solution based on test requirements
3. Apply fixes consistently across all 5 locations
4. Verify tests still validate the intended behavior
5. Run build to confirm errors are resolved

## Success Criteria

- [ ] All 5 `.push()` errors in scope_resolution.test.ts resolved
- [ ] Tests still pass and validate correct behavior
- [ ] No new TypeScript errors introduced
- [ ] Code follows existing test patterns

## Files to Modify

- `src/symbol_resolution/function_resolution/scope_resolution.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test file
npx vitest run src/symbol_resolution/function_resolution/scope_resolution.test.ts
```

## Dependencies

None - this is an isolated test file fix

## Notes

- These errors are in test code, not production code
- Maintaining test readability is important
- Consider creating a test helper if pattern repeats frequently