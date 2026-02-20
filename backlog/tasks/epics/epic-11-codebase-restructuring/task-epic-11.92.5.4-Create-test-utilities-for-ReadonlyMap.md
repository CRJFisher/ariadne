# Task: Create Test Utilities for ReadonlyMap

**Task ID**: task-epic-11.92.5.4
**Parent**: task-epic-11.92.5
**Status**: Pending
**Priority**: Critical
**Created**: 2025-01-22
**Estimated Effort**: 2 hours

## Summary

Create centralized utility functions for working with ReadonlyMaps in tests, reducing duplication and ensuring type safety across all test files.

## Problem

Multiple test files struggle with ReadonlyMap handling:
- Repeated patterns for creating ReadonlyMaps
- No standard way to convert between mutable and readonly
- Lack of type-safe helpers for test scenarios
- Duplicated workarounds across test files

## Solution Design

Create a new utility module with functions for:

1. **Creating ReadonlyMaps from various sources**
2. **Converting between mutable and readonly**
3. **Merging and combining ReadonlyMaps**
4. **Type-safe mutations for test scenarios**

## Implementation

```typescript
// test_utils/readonly_helpers.ts

/**
 * Create a ReadonlyMap from entries
 */
export function createReadonlyMap<K, V>(
  entries: Iterable<readonly [K, V]>
): ReadonlyMap<K, V> {
  return new Map(entries);
}

/**
 * Create a ReadonlyMap from an object
 */
export function objectToReadonlyMap<V>(
  obj: Record<string, V>
): ReadonlyMap<string, V> {
  return new Map(Object.entries(obj));
}

/**
 * Convert ReadonlyMap to mutable for test manipulation
 */
export function toMutable<K, V>(
  map: ReadonlyMap<K, V>
): Map<K, V> {
  return new Map(map);
}

/**
 * Add entries to a ReadonlyMap (returns new map)
 */
export function addToReadonlyMap<K, V>(
  map: ReadonlyMap<K, V>,
  entries: Iterable<readonly [K, V]>
): ReadonlyMap<K, V> {
  return new Map([...map, ...entries]);
}

/**
 * Merge multiple ReadonlyMaps (later maps override earlier)
 */
export function mergeReadonlyMaps<K, V>(
  ...maps: ReadonlyMap<K, V>[]
): ReadonlyMap<K, V> {
  const result = new Map<K, V>();
  for (const map of maps) {
    for (const [key, value] of map) {
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Create a builder for incremental ReadonlyMap construction
 */
export class ReadonlyMapBuilder<K, V> {
  private map = new Map<K, V>();

  add(key: K, value: V): this {
    this.map.set(key, value);
    return this;
  }

  addAll(entries: Iterable<readonly [K, V]>): this {
    for (const [key, value] of entries) {
      this.map.set(key, value);
    }
    return this;
  }

  build(): ReadonlyMap<K, V> {
    return new Map(this.map);
  }
}

/**
 * Type guard for ReadonlyMap
 */
export function isReadonlyMap<K, V>(
  value: unknown
): value is ReadonlyMap<K, V> {
  return value instanceof Map;
}

/**
 * Create nested ReadonlyMaps
 */
export function createNestedReadonlyMap<K1, K2, V>(
  entries: Array<[K1, Array<[K2, V]>]>
): ReadonlyMap<K1, ReadonlyMap<K2, V>> {
  return new Map(
    entries.map(([key, nested]) => [
      key,
      new Map(nested) as ReadonlyMap<K2, V>
    ])
  );
}
```

## Integration Steps

1. Create the utility file in test_utils directory
2. Add comprehensive tests for the utilities
3. Export from a test_utils index file
4. Update existing tests to use these utilities
5. Document usage patterns in comments

## Success Criteria

- [ ] Utility module created with all planned functions
- [ ] Utilities have their own test coverage
- [ ] At least 3 existing test files updated to use utilities
- [ ] Reduction in ReadonlyMap-related type errors
- [ ] Documentation includes usage examples

## Files to Create

- `src/test_utils/readonly_helpers.ts`
- `src/test_utils/readonly_helpers.test.ts`
- Update `src/test_utils/index.ts` (create if needed)

## Testing

```bash
# Test the utilities themselves
npx vitest run src/test_utils/readonly_helpers.test.ts

# Verify integration
npm run build

# Check that dependent tests still pass
npx vitest run
```

## Dependent Tasks

This task blocks:
- task-epic-11.92.5.1 (scope_resolution fixes)
- task-epic-11.92.5.2 (data_export fixes)
- task-epic-11.92.5.3 (type_resolution fixes)

## Notes

- Keep utilities generic and reusable
- Consider performance for large maps
- Ensure type inference works correctly
- Add JSDoc comments for better IDE support