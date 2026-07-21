# Task: Fix type_resolution Test ReadonlyMap Handling

**Task ID**: task-epic-11.92.5.3
**Parent**: task-epic-11.92.5
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2.5 hours

## Summary

Fix multiple ReadonlyMap-related TypeScript errors in `type_resolution/type_resolution.comprehensive.test.ts`, which has the highest concentration of errors (77 total).

## Problem

The test file has numerous issues with ReadonlyMap usage:
- Attempting to mutate ReadonlyMap instances
- Incorrect type assertions
- Mock data not conforming to ReadonlyMap interfaces
- Missing proper ReadonlyMap construction in test setups

## Specific Issues

Based on error analysis, common patterns include:
- Creating mutable Maps where ReadonlyMaps are expected
- Attempting to modify maps after creation
- Type mismatches when passing maps to functions

## Solution Approach

1. **Audit all Map usage in the test file**
   ```typescript
   // Instead of:
   const map = new Map();
   map.set(key, value);

   // Use:
   const map = new Map([
     [key1, value1],
     [key2, value2]
   ]) as ReadonlyMap<K, V>;
   ```

2. **Create helper functions for common patterns**
   ```typescript
   function createReadonlyTypeMap(entries: [TypeId, TypeInfo][]): ReadonlyMap<TypeId, TypeInfo> {
     return new Map(entries);
   }
   ```

3. **Fix mock object creation**
   ```typescript
   const mockRegistry: TypeRegistry = {
     types: createReadonlyTypeMap([...]),
     // ... other readonly properties
   };
   ```

## Implementation Steps

1. Scan file for all Map instantiations
2. Identify which should be ReadonlyMaps
3. Convert mutable map operations to immutable patterns
4. Create test-specific helper functions for common operations
5. Validate all type assertions match expected interfaces
6. Run type checking after each major section

## Success Criteria

- [ ] Significant reduction in TypeScript errors (target: reduce by 30+ errors)
- [ ] All ReadonlyMap interfaces properly satisfied
- [ ] Test logic unchanged - only type compliance fixed
- [ ] Helper functions documented and reusable

## Files to Modify

- `src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts`

## Testing

```bash
# Check compilation errors before and after
npm run build 2>&1 | grep "type_resolution.comprehensive.test.ts" | wc -l

# Run the test suite
npx vitest run src/symbol_resolution/type_resolution/type_resolution.comprehensive.test.ts
```

## Dependencies

- Should use utilities from task-epic-11.92.5.4 once available
- Coordinates with task-epic-11.92.6.4 for interface alignment

## Notes

- This file has the most errors in the codebase
- Focus on systematic patterns rather than one-off fixes
- Consider extracting common patterns to shared test utilities
- Document any workarounds needed for complex type scenarios