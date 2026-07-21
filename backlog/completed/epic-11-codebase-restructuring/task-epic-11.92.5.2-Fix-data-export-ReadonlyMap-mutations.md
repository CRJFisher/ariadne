# Task: Fix data_export ReadonlyMap Mutations

**Task ID**: task-epic-11.92.5.2
**Parent**: task-epic-11.92.5
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 1.5 hours

## Summary

Fix 3 TypeScript errors in `data_export/data_export.test.ts` where tests attempt to assign values to readonly properties.

## Problem

The test file attempts to modify readonly properties on objects:
- Line 324: `imports.set(...)` - Cannot assign to 'imports' because it is read-only
- Line 393: `resolved_references.set(...)` - Cannot assign to 'resolved_references' because it is read-only
- Line 400: `references_to_symbol.set(...)` - Cannot assign to 'references_to_symbol' because it is read-only

## Solution Approach

1. **Create objects with initial values instead of mutation**
   ```typescript
   const resolution_map = {
     imports: new Map([...existingEntries, [key, value]]),
     // ... other properties
   };
   ```

2. **Use type casting for test setup**
   ```typescript
   const mutableMap = resolution_map as {
     imports: Map<string, string>
   };
   mutableMap.imports.set(key, value);
   ```

3. **Create builder functions for test data**
   ```typescript
   function createResolutionMap(imports: Map<K, V>) {
     return {
       imports: imports as ReadonlyMap<K, V>,
       // ... other properties
     };
   }
   ```

## Implementation Steps

1. Analyze the test structure at each error location
2. Determine if mutation is necessary for test logic
3. Implement appropriate solution:
   - If testing mutation behavior: use type casting
   - If setting up test data: create with initial values
4. Ensure type safety is maintained where possible
5. Verify tests still validate intended behavior

## Success Criteria

- [ ] All 3 readonly assignment errors resolved
- [ ] Tests maintain their original validation logic
- [ ] Type safety preserved where appropriate
- [ ] No new TypeScript errors introduced

## Files to Modify

- `src/symbol_resolution/data_export/data_export.test.ts`

## Testing

```bash
# Verify compilation
npm run build

# Run specific test file
npx vitest run src/symbol_resolution/data_export/data_export.test.ts
```

## Dependencies

- May benefit from task-epic-11.92.5.4 (ReadonlyMap test utilities)

## Notes

- These are test-only changes
- Consider if the readonly constraint is correctly applied in production code
- Document any type casting with comments explaining why it's safe in tests